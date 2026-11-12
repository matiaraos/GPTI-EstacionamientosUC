import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { RankingConfig, ReservasConfig } from "../../config.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esViolacionUnica } from "../../lib/prisma-errors.js";
import { finDelDia, instanteFechaHora, partesLocales } from "../../lib/tiempo.js";
import { parseInput } from "../../lib/validation.js";
import { contenidoQr, nuevoIdentificadorQr } from "../catalogo/qr.js";
import { requiereRol, requiereSesion, sesionDe } from "../cuentas/sesiones.js";
import { atenderEsperas } from "../reservas/espera.js";
import { incluirReserva, reservaPublica } from "../reservas/presentacion.js";
import { estadoAutorizacion } from "./autorizaciones.js";

type Deps = { db: Database; clock: Clock; reservas: ReservasConfig; ranking: RankingConfig };

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const hora = (minuto: number) => `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;

const zonaSchema = z.object({
  nombre: z.string({ error: "Ingresa el nombre del bloque." }).trim().min(2, "Ingresa el nombre del bloque.").max(120),
  acceso: z.string().trim().max(300).nullish(),
  activa: z.boolean().optional(),
});

const horariosSchema = z.object({
  horarios: z
    .array(
      z
        .object({
          diaSemana: z.number().int().min(1, "Día inválido.").max(7, "Día inválido."),
          abre: z.string().regex(HORA, "Usa el formato HH:MM."),
          cierra: z.string().regex(HORA, "Usa el formato HH:MM."),
        })
        .refine((h) => minutos(h.cierra) > minutos(h.abre), { message: "El cierre debe ser posterior a la apertura.", path: ["cierra"] }),
    )
    .max(7)
    .refine((lista) => new Set(lista.map((h) => h.diaSemana)).size === lista.length, "Cada día puede aparecer una sola vez."),
});

const tipoPlaza = z.enum(["regular", "preferente"], { error: "El tipo debe ser regular o preferente." });

const nuevaPlazaSchema = z.object({
  zonaId: z.number({ error: "Elige el bloque." }).int().positive(),
  codigo: z.string({ error: "Ingresa el código de la plaza." }).trim().toUpperCase().min(1, "Ingresa el código de la plaza.").max(20),
  tipo: tipoPlaza.default("regular"),
});

const cambioPlazaSchema = z.object({
  codigo: z.string().trim().toUpperCase().min(1).max(20).optional(),
  tipo: tipoPlaza.optional(),
  activa: z.boolean().optional(),
});

const fechaHora = (campo: string) =>
  z
    .string({ error: `Indica ${campo}.` })
    .transform((valor, ctx) => {
      const instante = instanteFechaHora(valor);
      if (!instante) {
        ctx.addIssue({ code: "custom", message: "Usa una fecha y hora válidas (AAAA-MM-DDTHH:MM)." });
        return z.NEVER;
      }
      return instante;
    });

const bloqueoSchema = z
  .object({
    plazaId: z.number({ error: "Elige la plaza." }).int().positive(),
    inicio: fechaHora("el inicio"),
    fin: fechaHora("el término"),
    motivo: z.string({ error: "Indica el motivo." }).trim().min(3, "Indica el motivo.").max(300),
  })
  .refine((b) => b.fin > b.inicio, { message: "El término debe ser posterior al inicio.", path: ["fin"] });

const destinoCambioSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  activo: z.boolean().optional(),
});

/**
 * La habilitación preferente solo admite su vigencia. `strict` rechaza cualquier otro dato: el flujo
 * no solicita certificados ni motivos médicos (SC-002).
 */
const autorizacionSchema = z.strictObject(
  {
    vigenteHasta: z
      .string({ error: "Indica hasta qué día está vigente." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida (AAAA-MM-DD)."),
  },
  { error: "Solo se registra la vigencia. No ingreses certificados ni motivos médicos." },
);

/** Reservas que ocupan capacidad en la plaza y aún no terminan, opcionalmente dentro de un intervalo. */
async function reservasAfectadas(db: Database, plazaId: number, desde: Date, hasta?: Date) {
  const reservas = await db.reserva.findMany({
    where: {
      plazaId,
      estado: { in: ["confirmada", "en_uso"] },
      fin: { gt: desde },
      ...(hasta && { inicio: { lt: hasta } }),
    },
    orderBy: { inicio: "asc" },
    include: { ...incluirReserva, cuenta: { select: { id: true, correo: true } } },
  });
  return reservas.map((reserva) => ({ ...reservaPublica(reserva), cuenta: reserva.cuenta }));
}

const seleccionPlaza = (ahora: Date) =>
  ({
    id: true,
    codigo: true,
    tipo: true,
    activa: true,
    zona: { select: { id: true, nombre: true, idOrigen: true } },
    qrs: { where: { revocadoEn: null }, select: { identificador: true } },
    bloqueos: {
      where: { levantadoEn: null, fin: { gt: ahora } },
      orderBy: { inicio: "asc" },
      select: { id: true, inicio: true, fin: true, motivo: true },
    },
  }) satisfies Prisma.PlazaSelect;

type PlazaSeleccionada = Prisma.PlazaGetPayload<{ select: ReturnType<typeof seleccionPlaza> }>;

function plazaPublica({ qrs, bloqueos, ...plaza }: PlazaSeleccionada, ahora: Date) {
  return {
    ...plaza,
    qr: qrs[0] ? contenidoQr(qrs[0].identificador) : null,
    bloqueada: bloqueos.some((b) => b.inicio <= ahora),
    bloqueos,
  };
}

const noEncontrada = (que: string) => new HttpError(404, "no_encontrado", `No encontramos ${que}.`);

function bloqueoPublico(bloqueo: {
  id: number;
  inicio: Date;
  fin: Date;
  motivo: string;
  creadoEn: Date;
  levantadoEn: Date | null;
  plaza: { id: number; codigo: string; zona: { id: number; nombre: string } };
  creadoPor: { correo: string };
}) {
  const inicio = partesLocales(bloqueo.inicio);
  const fin = partesLocales(bloqueo.fin);
  return {
    ...bloqueo,
    inicioLocal: `${inicio.fecha} ${inicio.hora}`,
    finLocal: `${fin.fecha} ${fin.hora}`,
  };
}

const incluirBloqueo = {
  plaza: { select: { id: true, codigo: true, zona: { select: { id: true, nombre: true } } } },
  creadoPor: { select: { correo: true } },
} as const;

/** Gestión del inventario y de las habilitaciones preferentes. Solo para cuentas `admin` (02B). */
export function crearRutasInventario({ db, clock, reservas, ranking }: Deps) {
  const router = Router();
  // Al liberar capacidad (activar, levantar un bloqueo, abrir horario) se atiende la lista de espera.
  const atender = () => atenderEsperas(db, clock, reservas, ranking);
  router.use("/admin", requiereSesion(db, clock), requiereRol("admin"));

  // Zonas (bloques) y horarios

  router.get("/admin/zonas", async (_request, response) => {
    const zonas = await db.zona.findMany({
      orderBy: [{ activa: "desc" }, { id: "asc" }],
      select: {
        id: true,
        idOrigen: true,
        nombre: true,
        activa: true,
        acceso: true,
        horarios: { orderBy: { diaSemana: "asc" }, select: { diaSemana: true, abreMinuto: true, cierraMinuto: true } },
        plazas: { select: { tipo: true, activa: true } },
      },
    });
    response.json({
      zonas: zonas.map(({ horarios, plazas, ...zona }) => ({
        ...zona,
        horarios: horarios.map((h) => ({ diaSemana: h.diaSemana, abre: hora(h.abreMinuto), cierra: hora(h.cierraMinuto) })),
        plazas: {
          total: plazas.length,
          activas: plazas.filter((p) => p.activa).length,
          preferentes: plazas.filter((p) => p.tipo === "preferente").length,
        },
      })),
    });
  });

  router.post("/admin/zonas", async (request, response) => {
    const datos = parseInput(zonaSchema, request.body);
    const zona = await db.zona.create({ data: { nombre: datos.nombre, acceso: datos.acceso ?? null, activa: datos.activa ?? true } });
    response.status(201).json({ zona });
  });

  router.patch("/admin/zonas/:id", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const datos = parseInput(zonaSchema.partial(), request.body);
    const { count } = await db.zona.updateMany({ where: { id }, data: datos });
    if (count === 0) {
      throw noEncontrada("ese bloque");
    }
    if (datos.activa) await atender();
    response.json({ zona: await db.zona.findUniqueOrThrow({ where: { id } }) });
  });

  /** Reemplaza el horario semanal del bloque. Un día ausente queda cerrado. */
  router.put("/admin/zonas/:id/horarios", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const { horarios } = parseInput(horariosSchema, request.body);
    if (!(await db.zona.findUnique({ where: { id }, select: { id: true } }))) {
      throw noEncontrada("ese bloque");
    }
    await db.$transaction([
      db.horarioZona.deleteMany({ where: { zonaId: id } }),
      db.horarioZona.createMany({
        data: horarios.map((h) => ({ zonaId: id, diaSemana: h.diaSemana, abreMinuto: minutos(h.abre), cierraMinuto: minutos(h.cierra) })),
      }),
    ]);
    await atender();
    response.json({ horarios: [...horarios].sort((a, b) => a.diaSemana - b.diaSemana) });
  });

  // Plazas y QR

  router.get("/admin/plazas", async (request, response) => {
    const { zonaId } = parseInput(z.object({ zonaId: z.coerce.number().int().positive().optional() }), request.query);
    const ahora = clock();
    const plazas = await db.plaza.findMany({
      where: zonaId ? { zonaId } : {},
      orderBy: [{ zonaId: "asc" }, { codigo: "asc" }],
      select: seleccionPlaza(ahora),
    });
    response.json({ plazas: plazas.map((plaza) => plazaPublica(plaza, ahora)) });
  });

  router.post("/admin/plazas", async (request, response) => {
    const datos = parseInput(nuevaPlazaSchema, request.body);
    if (!(await db.zona.findUnique({ where: { id: datos.zonaId }, select: { id: true } }))) {
      throw new HttpError(400, "datos_invalidos", "Revisa los datos de la plaza.", { zonaId: "El bloque no existe." });
    }
    const ahora = clock();
    try {
      const plaza = await db.plaza.create({
        data: { ...datos, qrs: { create: { identificador: nuevoIdentificadorQr(), creadoEn: ahora } } },
        select: seleccionPlaza(ahora),
      });
      response.status(201).json({ plaza: plazaPublica(plaza, ahora) });
    } catch (error) {
      if (esViolacionUnica(error)) {
        throw new HttpError(409, "plaza_duplicada", "Ya existe una plaza con ese código en el bloque.", {
          codigo: "Ya existe una plaza con ese código en el bloque.",
        });
      }
      throw error;
    }
  });

  /** Reservas vigentes de la plaza: se muestran antes de desactivarla, cambiar su tipo o bloquearla. */
  router.get("/admin/plazas/:id/reservas-afectadas", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const rango = parseInput(
      z.object({ inicio: fechaHora("el inicio").optional(), fin: fechaHora("el término").optional() }),
      request.query,
    );
    response.json({ reservas: await reservasAfectadas(db, id, rango.inicio ?? clock(), rango.fin) });
  });

  /**
   * Cambia código, tipo o estado. Una plaza no se elimina: desactivarla conserva su historial y la
   * excluye de nuevas asignaciones. La respuesta incluye las reservas vigentes que quedan afectadas.
   */
  router.patch("/admin/plazas/:id", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const datos = parseInput(cambioPlazaSchema, request.body);
    const ahora = clock();
    try {
      const { count } = await db.plaza.updateMany({ where: { id }, data: datos });
      if (count === 0) {
        throw noEncontrada("esa plaza");
      }
    } catch (error) {
      if (esViolacionUnica(error)) {
        throw new HttpError(409, "plaza_duplicada", "Ya existe una plaza con ese código en el bloque.", {
          codigo: "Ya existe una plaza con ese código en el bloque.",
        });
      }
      throw error;
    }
    if (datos.activa || datos.tipo) await atender();
    const plaza = await db.plaza.findUniqueOrThrow({ where: { id }, select: seleccionPlaza(ahora) });
    const afecta = datos.activa === false || datos.tipo !== undefined;
    response.json({
      plaza: plazaPublica(plaza, ahora),
      reservasAfectadas: afecta ? await reservasAfectadas(db, id, ahora) : [],
    });
  });

  /** Reemplaza el QR vigente por uno nuevo (por ejemplo, si el impreso se dañó o se copió). */
  router.post("/admin/plazas/:id/qr", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const ahora = clock();
    if (!(await db.plaza.findUnique({ where: { id }, select: { id: true } }))) {
      throw noEncontrada("esa plaza");
    }
    const [, nuevo] = await db.$transaction([
      db.qrPlaza.updateMany({ where: { plazaId: id, revocadoEn: null }, data: { revocadoEn: ahora } }),
      db.qrPlaza.create({ data: { plazaId: id, identificador: nuevoIdentificadorQr(), creadoEn: ahora } }),
    ]);
    response.status(201).json({ qr: contenidoQr(nuevo.identificador) });
  });

  /** Revoca el QR vigente sin reemplazo: la plaza no admite check-in hasta emitir uno nuevo. */
  router.delete("/admin/plazas/:id/qr", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    await db.qrPlaza.updateMany({ where: { plazaId: id, revocadoEn: null }, data: { revocadoEn: clock() } });
    response.status(204).end();
  });

  // Bloqueos

  router.get("/admin/bloqueos", async (request, response) => {
    const { todos } = parseInput(z.object({ todos: z.enum(["0", "1"]).default("0") }), request.query);
    const ahora = clock();
    const bloqueos = await db.bloqueoPlaza.findMany({
      where: todos === "1" ? {} : { levantadoEn: null, fin: { gt: ahora } },
      orderBy: [{ inicio: "desc" }],
      include: incluirBloqueo,
      take: 200,
    });
    response.json({ bloqueos: bloqueos.map(bloqueoPublico) });
  });

  router.post("/admin/bloqueos", async (request, response) => {
    const datos = parseInput(bloqueoSchema, request.body);
    if (!(await db.plaza.findUnique({ where: { id: datos.plazaId }, select: { id: true } }))) {
      throw new HttpError(400, "datos_invalidos", "Revisa los datos del bloqueo.", { plazaId: "La plaza no existe." });
    }
    const bloqueo = await db.bloqueoPlaza.create({
      data: { ...datos, creadoPorId: sesionDe(response).cuentaId, creadoEn: clock() },
      include: incluirBloqueo,
    });
    response.status(201).json({
      bloqueo: bloqueoPublico(bloqueo),
      reservasAfectadas: await reservasAfectadas(db, datos.plazaId, datos.inicio, datos.fin),
    });
  });

  /** Levanta el bloqueo: la plaza vuelve a estar disponible. Se conserva en el historial. */
  router.post("/admin/bloqueos/:id/levantar", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    await db.bloqueoPlaza.updateMany({ where: { id, levantadoEn: null }, data: { levantadoEn: clock() } });
    const bloqueo = await db.bloqueoPlaza.findUnique({ where: { id }, include: incluirBloqueo });
    if (!bloqueo) {
      throw noEncontrada("ese bloqueo");
    }
    await atender();
    response.json({ bloqueo: bloqueoPublico(bloqueo) });
  });

  // Edificios y salas de destino

  router.get("/admin/destinos", async (request, response) => {
    const { tipo, q } = parseInput(
      z.object({ tipo: z.enum(["sala", "edificio"]).optional(), q: z.string().trim().max(80).default("") }),
      request.query,
    );
    const destinos = await db.destino.findMany({
      where: {
        ...(tipo && { tipo }),
        ...(q && { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { idOrigen: { contains: q, mode: "insensitive" } }] }),
      },
      orderBy: [{ nombre: "asc" }, { idOrigen: "asc" }],
      select: { id: true, idOrigen: true, nombre: true, tipo: true, activo: true, _count: { select: { cercanias: true } } },
      take: 300,
    });
    response.json({
      destinos: destinos.map(({ _count, ...destino }) => ({ ...destino, bloquesConDistancia: _count.cercanias })),
    });
  });

  router.patch("/admin/destinos/:id", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const datos = parseInput(destinoCambioSchema, request.body);
    const { count } = await db.destino.updateMany({ where: { id }, data: datos });
    if (count === 0) {
      throw noEncontrada("ese destino");
    }
    response.json({ destino: await db.destino.findUniqueOrThrow({ where: { id } }) });
  });

  // Habilitaciones preferentes

  router.get("/admin/autorizaciones", async (_request, response) => {
    const ahora = clock();
    const autorizaciones = await db.autorizacionPreferente.findMany({
      orderBy: { otorgadaEn: "desc" },
      include: { cuenta: { select: { id: true, correo: true } }, otorgadaPor: { select: { correo: true } } },
    });
    response.json({
      autorizaciones: autorizaciones.map((a) => ({
        cuenta: a.cuenta,
        vigenteHasta: a.vigenteHasta,
        revocadaEn: a.revocadaEn,
        otorgadaEn: a.otorgadaEn,
        otorgadaPor: a.otorgadaPor.correo,
        estado: estadoAutorizacion(a, ahora),
      })),
    });
  });

  /** Otorga o renueva la habilitación hasta el fin del día indicado (hora de Santiago). */
  router.put("/admin/cuentas/:id/autorizacion", async (request, response) => {
    const { id: cuentaId } = parseInput(idSchema, request.params);
    const { vigenteHasta: fecha } = parseInput(autorizacionSchema, request.body);
    const ahora = clock();
    const vigenteHasta = finDelDia(fecha);
    if (!vigenteHasta || vigenteHasta <= ahora) {
      throw new HttpError(400, "datos_invalidos", "Revisa la vigencia.", { vigenteHasta: "La vigencia debe terminar hoy o después." });
    }
    if (!(await db.cuenta.findUnique({ where: { id: cuentaId }, select: { id: true } }))) {
      throw noEncontrada("esa cuenta");
    }
    const datos = { vigenteHasta, revocadaEn: null, otorgadaEn: ahora, otorgadaPorId: sesionDe(response).cuentaId };
    const autorizacion = await db.autorizacionPreferente.upsert({
      where: { cuentaId },
      create: { cuentaId, ...datos },
      update: datos,
    });
    response.json({ autorizacion: { ...autorizacion, estado: estadoAutorizacion(autorizacion, ahora) } });
  });

  router.post("/admin/cuentas/:id/autorizacion/revocar", async (request, response) => {
    const { id: cuentaId } = parseInput(idSchema, request.params);
    const ahora = clock();
    await db.autorizacionPreferente.updateMany({ where: { cuentaId, revocadaEn: null }, data: { revocadaEn: ahora } });
    const autorizacion = await db.autorizacionPreferente.findUnique({ where: { cuentaId } });
    if (!autorizacion) {
      throw noEncontrada("una habilitación para esa cuenta");
    }
    response.json({ autorizacion: { ...autorizacion, estado: estadoAutorizacion(autorizacion, ahora) } });
  });

  return router;
}
