import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { RankingConfig, RecurrenciaConfig, ReservasConfig } from "../../config.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { partesLocales } from "../../lib/tiempo.js";
import { parseInput } from "../../lib/validation.js";
import { requiereRol, requiereSesion, sesionDe } from "../cuentas/sesiones.js";
import { puntajeDe } from "../ranking/ajustes.js";
import { atenderEsperas } from "../reservas/espera.js";
import { incluirReserva, reservaPublica } from "../reservas/presentacion.js";
import { cancelarSerie, crearSerie, cupoZona, procesarRenovaciones, textoFecha } from "./series.js";

type Deps = { db: Database; clock: Clock; reservas: ReservasConfig; ranking: RankingConfig; recurrencia: RecurrenciaConfig };

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const serieSchema = z.object({
  bloques: z
    .array(
      z.object({
        diaSemana: z.number({ error: "Elige el día." }).int().min(1, "Elige el día.").max(7, "Elige el día."),
        llegada: z.string({ error: "Indica la llegada." }).regex(HORA, "Usa el formato HH:MM."),
        salida: z.string({ error: "Indica la salida." }).regex(HORA, "Usa el formato HH:MM."),
        destinoId: z.number().int().positive().nullish(),
      }),
    )
    .min(1, "Agrega al menos un bloque semanal."),
  semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida (AAAA-MM-DD).").optional(),
});

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Reservas semanales recurrentes (07, RF-22 y SC-001). */
export function crearRutasRecurrencia({ db, clock, reservas, ranking, recurrencia }: Deps) {
  const router = Router();
  router.use("/series", requiereSesion(db, clock));
  const deps = { reservas, ranking, recurrencia };

  async function zonaPiloto() {
    return recurrencia.zonaPiloto ? db.zona.findUnique({ where: { idOrigen: recurrencia.zonaPiloto } }) : null;
  }

  /** Requisitos para fijar bloques: puntaje mínimo, bloques disponibles y cupo de la zona piloto. */
  router.get("/series/elegibilidad", async (_request, response) => {
    const { cuentaId } = sesionDe(response);
    const puntaje = await puntajeDe(db, cuentaId, ranking);
    const usados = await db.bloqueSerie.count({ where: { serie: { cuentaId, estado: "activa" } } });
    const zona = await zonaPiloto();
    const cupo = zona ? await cupoZona(db, zona.id, recurrencia) : null;
    response.json({
      elegible: puntaje >= recurrencia.umbralPuntaje && usados < recurrencia.maxBloques && (!cupo || cupo.usadas < cupo.tope),
      puntaje,
      umbral: recurrencia.umbralPuntaje,
      bloques: { usados, maximo: recurrencia.maxBloques },
      zona: zona && cupo ? { id: zona.id, nombre: zona.nombre, ...cupo, porcentaje: recurrencia.topePct } : null,
    });
  });

  router.get("/series", async (_request, response) => {
    const { cuentaId } = sesionDe(response);
    const ahora = clock();
    const series = await db.serieReserva.findMany({
      where: { cuentaId },
      orderBy: [{ estado: "asc" }, { creadaEn: "desc" }],
      include: {
        zona: { select: { id: true, nombre: true } },
        bloques: {
          orderBy: [{ diaSemana: "asc" }, { inicioMinuto: "asc" }],
          include: {
            destino: { select: { id: true, idOrigen: true, nombre: true, tipo: true } },
            reservas: { where: { fin: { gt: ahora } }, orderBy: { inicio: "asc" }, include: incluirReserva },
          },
        },
      },
    });
    response.json({
      series: series.map((s) => ({
        id: s.id,
        estado: s.estado,
        zona: s.zona,
        creadaEn: s.creadaEn,
        semanaHasta: textoFecha(s.semanaHasta),
        motivoCierre: s.motivoCierre,
        bloques: s.bloques.map((b) => ({ id: b.id, diaSemana: b.diaSemana, llegada: hhmm(b.inicioMinuto), salida: hhmm(b.finMinuto), destino: b.destino })),
        ocurrencias: s.bloques
          .flatMap((b) => b.reservas)
          .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
          .map(reservaPublica),
      })),
    });
  });

  /** Crea la serie y sus ocurrencias de la primera semana. `Idempotency-Key` evita duplicarla. */
  router.post("/series", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const { clave } = parseInput(z.object({ clave: z.string({ error: "Falta la clave de la solicitud (Idempotency-Key)." }).trim().min(8).max(100) }), {
      clave: request.get("idempotency-key"),
    });
    const datos = parseInput(serieSchema, request.body);
    const vehiculo = await db.vehiculo.findFirst({ where: { cuentaId }, orderBy: { id: "asc" }, select: { id: true } });
    if (!vehiculo) {
      throw new HttpError(400, "datos_invalidos", "Registra un vehículo antes de reservar.", { vehiculoId: "Registra un vehículo en tu cuenta." });
    }
    const resultado = await crearSerie(db, clock, deps, { cuentaId, vehiculoId: vehiculo.id, bloques: datos.bloques, semana: datos.semana, clave });
    response.status(resultado.reintento ? 200 : 201).json({ serie: { id: resultado.serieId } });
  });

  /** Cancela la serie y libera sus ocurrencias futuras. Para una sola fecha, se cancela esa reserva. */
  router.post("/series/:id/cancelar", async (request, response) => {
    const { id } = parseInput(z.object({ id: z.coerce.number().int().positive() }), request.params);
    const liberadas = await cancelarSerie(db, clock, sesionDe(response).cuentaId, id);
    if (liberadas > 0) await atenderEsperas(db, clock, reservas, ranking);
    response.json({ liberadas });
  });

  /** Ejecuta la renovación semanal ahora. Fuera del fin de semana requiere `forzar` (para pruebas y demo). */
  router.post("/admin/procesos/renovaciones", requiereSesion(db, clock), requiereRol("admin"), async (request, response) => {
    const { forzar } = parseInput(z.object({ forzar: z.boolean().default(false) }), request.body);
    const resultado = await procesarRenovaciones(db, clock, deps, { forzar });
    response.json({ ...resultado, dia: partesLocales(clock()).diaSemana });
  });

  return router;
}
