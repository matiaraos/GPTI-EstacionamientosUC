import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { RankingConfig, ReservasConfig } from "../../config.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { instanteFechaHora, instanteLocal, partesLocales } from "../../lib/tiempo.js";
import { parseInput } from "../../lib/validation.js";
import { requiereRol, requiereSesion, sesionDe } from "../cuentas/sesiones.js";
import { atenderEsperas } from "../reservas/espera.js";

type Deps = { db: Database; clock: Clock; reservas: ReservasConfig; ranking: RankingConfig };

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida (AAAA-MM-DD).");

const periodoSchema = z.object({ desde: fecha.optional(), hasta: fecha.optional() });

const reporteSchema = z.object({
  plazaId: z.number({ error: "Elige la plaza." }).int().positive(),
  reservaId: z.number().int().positive().nullish(),
  descripcion: z.string({ error: "Describe lo ocurrido." }).trim().min(5, "Describe lo ocurrido.").max(1000),
});

const reporteUsuarioSchema = z.object({
  reservaId: z.number({ error: "Indica la reserva." }).int().positive(),
  descripcion: z.string({ error: "Describe lo ocurrido." }).trim().min(5, "Describe lo ocurrido.").max(1000),
});

const resolucionSchema = z
  .object({
    resultado: z.enum(["validado", "descartado"], { error: "Indica si el incidente se valida o se descarta." }),
    motivo: z.string({ error: "Indica el motivo de la resolución." }).trim().min(5, "Indica el motivo de la resolución.").max(1000),
    /** Sanción al titular de la reserva asociada; solo si se valida. */
    sancion: z.number().int().min(-100).max(-1).nullish(),
    /** Bloquea la plaza hasta cerrar el incidente; solo si se valida. */
    bloquear: z.boolean().default(false),
  })
  .refine((r) => r.resultado === "validado" || (!r.sancion && !r.bloquear), {
    message: "Un incidente descartado no puede sancionar ni bloquear.",
    path: ["resultado"],
  });

const cierreSchema = z.object({
  motivo: z.string({ error: "Indica cómo se resolvió." }).trim().min(5, "Indica cómo se resolvió.").max(1000),
});

const incluirIncidente = {
  plaza: { select: { id: true, codigo: true, zona: { select: { id: true, nombre: true } } } },
  reserva: { select: { id: true, inicio: true, fin: true, estado: true, cuenta: { select: { id: true, correo: true } } } },
  reportadoPor: { select: { correo: true, rol: true } },
  resueltoPor: { select: { correo: true } },
  bloqueos: { select: { id: true, levantadoEn: true } },
  ajustes: { select: { id: true, variacion: true } },
} as const;

type IncidenteCompleto = Awaited<ReturnType<Database["incidente"]["findFirstOrThrow"]>> & {
  plaza: { id: number; codigo: string; zona: { id: number; nombre: string } };
  reserva: { id: number; inicio: Date; fin: Date; estado: string; cuenta: { id: number; correo: string } } | null;
  reportadoPor: { correo: string; rol: string };
  resueltoPor: { correo: string } | null;
  bloqueos: { id: number; levantadoEn: Date | null }[];
  ajustes: { id: number; variacion: number }[];
};

function incidentePublico(i: IncidenteCompleto) {
  return {
    id: i.id,
    estado: i.estado,
    descripcion: i.descripcion,
    reportadoEn: i.reportadoEn,
    reportadoPor: i.reportadoPor.correo,
    plaza: i.plaza,
    reserva: i.reserva
      ? {
          id: i.reserva.id,
          estado: i.reserva.estado,
          fecha: partesLocales(i.reserva.inicio).fecha,
          llegada: partesLocales(i.reserva.inicio).hora,
          salida: partesLocales(i.reserva.fin).hora,
          cuenta: i.reserva.cuenta,
        }
      : null,
    resueltoPor: i.resueltoPor?.correo ?? null,
    motivoResolucion: i.motivoResolucion,
    resueltoEn: i.resueltoEn,
    cerradoEn: i.cerradoEn,
    bloqueoVigente: i.bloqueos.some((b) => !b.levantadoEn),
    sancion: i.ajustes.reduce((t, a) => t + a.variacion, 0) || null,
  };
}

/** Siguiente día de una fecha local. */
const diaSiguiente = (f: string) => new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10) + 1)).toISOString().slice(0, 10);

/** Ocupación, resumen del período e incidentes con su resolución (08A). Solo para administración. */
export function crearRutasOperacion({ db, clock, reservas, ranking }: Deps) {
  const router = Router();
  const conSesion = requiereSesion(db, clock);
  const admin = [conSesion, requiereRol("admin")];

  /**
   * Estado de cada plaza en un instante (por defecto, ahora): inactiva, bloqueada, en uso, reservada o
   * libre, en ese orden de precedencia. Se deriva de plazas, bloqueos y reservas.
   */
  router.get("/admin/ocupacion", ...admin, async (request, response) => {
    const { en } = parseInput(z.object({ en: z.string().optional() }), request.query);
    const instante = en ? instanteFechaHora(en) : clock();
    if (!instante) {
      throw new HttpError(400, "datos_invalidos", "Revisa el instante.", { en: "Usa el formato AAAA-MM-DDTHH:MM." });
    }
    const plazas = await db.plaza.findMany({
      orderBy: [{ zonaId: "asc" }, { codigo: "asc" }],
      select: {
        id: true,
        codigo: true,
        tipo: true,
        activa: true,
        zona: { select: { id: true, nombre: true } },
        bloqueos: { where: { levantadoEn: null, inicio: { lte: instante }, fin: { gt: instante } }, select: { motivo: true, incidenteId: true }, take: 1 },
        reservas: {
          where: {
            OR: [{ estado: "en_uso" }, { estado: "confirmada", inicio: { lte: instante }, fin: { gt: instante } }],
          },
          select: { id: true, estado: true, inicio: true, fin: true, cuenta: { select: { correo: true } } },
          orderBy: { estado: "desc" },
          take: 1,
        },
        incidentes: { where: { estado: { in: ["pendiente", "validado"] } }, select: { id: true, estado: true } },
      },
    });
    const filas = plazas.map((p) => {
      const reserva = p.reservas[0];
      const estado = !p.activa
        ? "inactiva"
        : p.bloqueos.length
          ? "bloqueada"
          : reserva?.estado === "en_uso"
            ? "en_uso"
            : reserva
              ? "reservada"
              : "libre";
      return {
        id: p.id,
        codigo: p.codigo,
        tipo: p.tipo,
        zona: p.zona,
        estado,
        motivoBloqueo: p.bloqueos[0]?.motivo ?? null,
        reserva: reserva
          ? { id: reserva.id, llegada: partesLocales(reserva.inicio).hora, salida: partesLocales(reserva.fin).hora, cuenta: reserva.cuenta.correo }
          : null,
        incidentesAbiertos: p.incidentes.length,
      };
    });
    const totales = { libre: 0, reservada: 0, en_uso: 0, bloqueada: 0, inactiva: 0 };
    for (const f of filas) totales[f.estado as keyof typeof totales]++;
    response.json({ instante, totales, plazas: filas });
  });

  /**
   * Resumen de un período de días locales `[desde, hasta]`: reservas por estado (según su inicio),
   * eventos de entrada y salida registrados, salidas a tiempo, ausencias, vencimientos e incidentes.
   */
  router.get("/admin/ocupacion/periodo", ...admin, async (request, response) => {
    const hoy = partesLocales(clock()).fecha;
    const { desde = hoy, hasta = desde } = parseInput(periodoSchema, request.query);
    const inicio = instanteLocal(desde, "00:00") ?? instanteLocal(desde, "01:00");
    const fin = instanteLocal(diaSiguiente(hasta), "00:00") ?? instanteLocal(diaSiguiente(hasta), "01:00");
    if (!inicio || !fin || fin <= inicio) {
      throw new HttpError(400, "datos_invalidos", "Revisa el período.", { hasta: "El término debe ser igual o posterior al inicio." });
    }
    const [porEstado, eventos, salidasATiempo, incidentes] = await Promise.all([
      db.reserva.groupBy({ by: ["estado"], where: { inicio: { gte: inicio, lt: fin } }, _count: { _all: true } }),
      db.eventoReserva.groupBy({ by: ["tipo"], where: { registradoEn: { gte: inicio, lt: fin } }, _count: { _all: true } }),
      db.ajusteRanking.count({ where: { tipo: "salida_a_tiempo", reserva: { inicio: { gte: inicio, lt: fin } } } }),
      db.incidente.groupBy({ by: ["estado"], where: { reportadoEn: { gte: inicio, lt: fin } }, _count: { _all: true } }),
    ]);
    const reservasPorEstado = Object.fromEntries(
      ["confirmada", "en_uso", "finalizada", "cancelada", "ausente", "vencida"].map((e) => [e, porEstado.find((g) => g.estado === e)?._count._all ?? 0]),
    );
    response.json({
      desde,
      hasta,
      reservas: { total: Object.values(reservasPorEstado).reduce((a, b) => a + b, 0), ...reservasPorEstado },
      eventos: {
        entradas: eventos.find((g) => g.tipo === "entrada")?._count._all ?? 0,
        salidas: eventos.find((g) => g.tipo === "salida")?._count._all ?? 0,
      },
      salidasATiempo,
      incidentes: Object.fromEntries(["pendiente", "validado", "descartado", "cerrado"].map((e) => [e, incidentes.find((g) => g.estado === e)?._count._all ?? 0])),
    });
  });

  // Incidentes

  router.get("/admin/incidentes", ...admin, async (request, response) => {
    const { estado } = parseInput(z.object({ estado: z.enum(["pendiente", "validado", "descartado", "cerrado"]).optional() }), request.query);
    const incidentes = await db.incidente.findMany({
      where: estado ? { estado } : {},
      orderBy: [{ reportadoEn: "desc" }],
      include: incluirIncidente,
      take: 200,
    });
    response.json({ incidentes: incidentes.map((i) => incidentePublico(i as IncidenteCompleto)) });
  });

  router.post("/admin/incidentes", ...admin, async (request, response) => {
    const datos = parseInput(reporteSchema, request.body);
    if (!(await db.plaza.findUnique({ where: { id: datos.plazaId }, select: { id: true } }))) {
      throw new HttpError(400, "datos_invalidos", "Revisa el incidente.", { plazaId: "La plaza no existe." });
    }
    if (datos.reservaId && !(await db.reserva.findFirst({ where: { id: datos.reservaId, plazaId: datos.plazaId }, select: { id: true } }))) {
      throw new HttpError(400, "datos_invalidos", "Revisa el incidente.", { reservaId: "La reserva no corresponde a esa plaza." });
    }
    const incidente = await db.incidente.create({
      data: { ...datos, reservaId: datos.reservaId ?? null, reportadoEn: clock(), reportadoPorId: sesionDe(response).cuentaId },
      include: incluirIncidente,
    });
    response.status(201).json({ incidente: incidentePublico(incidente as IncidenteCompleto) });
  });

  /** Una persona reporta un problema en la plaza de su reserva (por ejemplo, ocupada por otro vehículo). */
  router.post("/incidentes", conSesion, async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const datos = parseInput(reporteUsuarioSchema, request.body);
    const reserva = await db.reserva.findFirst({ where: { id: datos.reservaId, cuentaId }, select: { id: true, plazaId: true } });
    if (!reserva) {
      throw new HttpError(404, "reserva_no_encontrada", "No encontramos esa reserva.");
    }
    const incidente = await db.incidente.create({
      data: { plazaId: reserva.plazaId, reservaId: reserva.id, descripcion: datos.descripcion, reportadoEn: clock(), reportadoPorId: cuentaId },
    });
    response.status(201).json({ incidente: { id: incidente.id, estado: incidente.estado } });
  });

  /**
   * Resuelve un incidente pendiente con responsable y motivo. Solo al validarlo puede sancionar al
   * titular de la reserva asociada (una vez por incidente) y bloquear la plaza hasta cerrarlo.
   */
  router.post("/admin/incidentes/:id/resolver", ...admin, async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const datos = parseInput(resolucionSchema, request.body);
    const responsable = sesionDe(response).cuentaId;
    const ahora = clock();
    const incidente = await db.incidente.findUnique({ where: { id }, include: { reserva: { select: { id: true, cuentaId: true } } } });
    if (!incidente) {
      throw new HttpError(404, "no_encontrado", "No encontramos ese incidente.");
    }
    if (datos.sancion && !incidente.reserva) {
      throw new HttpError(400, "datos_invalidos", "Revisa la resolución.", { sancion: "Solo se sanciona un incidente asociado a una reserva." });
    }
    await db.$transaction(async (tx) => {
      const { count } = await tx.incidente.updateMany({
        where: { id, estado: "pendiente" },
        data: { estado: datos.resultado, motivoResolucion: datos.motivo, resueltoPorId: responsable, resueltoEn: ahora },
      });
      if (count === 0) {
        throw new HttpError(409, "incidente_resuelto", "Este incidente ya fue resuelto.");
      }
      if (datos.resultado !== "validado") return;
      if (datos.sancion && incidente.reserva) {
        await tx.ajusteRanking.create({
          data: {
            cuentaId: incidente.reserva.cuentaId,
            reservaId: incidente.reserva.id,
            incidenteId: id,
            autorRectificacionId: responsable,
            tipo: "incidente",
            claveOrigen: `incidente:${id}`,
            variacion: datos.sancion,
            motivo: `Incidente validado: ${datos.motivo}`,
            registradoEn: ahora,
          },
        });
      }
      if (datos.bloquear) {
        // Sin término conocido: el bloqueo dura hasta cerrar el incidente.
        await tx.bloqueoPlaza.create({
          data: {
            plazaId: incidente.plazaId,
            incidenteId: id,
            inicio: ahora,
            fin: new Date("9999-12-31T00:00:00Z"),
            motivo: `Incidente #${id}: ${datos.motivo}`,
            creadoPorId: responsable,
            creadoEn: ahora,
          },
        });
      }
    });
    const resuelto = await db.incidente.findUniqueOrThrow({ where: { id }, include: incluirIncidente });
    response.json({ incidente: incidentePublico(resuelto as IncidenteCompleto) });
  });

  /** Cierra un incidente validado y levanta sus bloqueos. */
  router.post("/admin/incidentes/:id/cerrar", ...admin, async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const { motivo } = parseInput(cierreSchema, request.body);
    const ahora = clock();
    const cerrado = await db.$transaction(async (tx) => {
      const { count } = await tx.incidente.updateMany({
        where: { id, estado: "validado" },
        data: { estado: "cerrado", cerradoEn: ahora, motivoResolucion: motivo },
      });
      if (count === 0) return false;
      await tx.bloqueoPlaza.updateMany({ where: { incidenteId: id, levantadoEn: null }, data: { levantadoEn: ahora } });
      return true;
    });
    if (!cerrado) {
      throw new HttpError(409, "incidente_no_validado", "Solo se cierra un incidente validado.");
    }
    await atenderEsperas(db, clock, reservas, ranking);
    const incidente = await db.incidente.findUniqueOrThrow({ where: { id }, include: incluirIncidente });
    response.json({ incidente: incidentePublico(incidente as IncidenteCompleto) });
  });

  return router;
}
