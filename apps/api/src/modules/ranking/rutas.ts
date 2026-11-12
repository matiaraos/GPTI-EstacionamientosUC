import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { RankingConfig, ReservasConfig } from "../../config.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esViolacionUnica } from "../../lib/prisma-errors.js";
import { partesLocales } from "../../lib/tiempo.js";
import { parseInput } from "../../lib/validation.js";
import { requiereRol, requiereSesion, sesionDe } from "../cuentas/sesiones.js";
import { puntajeDe } from "./ajustes.js";
import { procesarVencimientos } from "./vencimientos.js";

type Deps = { db: Database; clock: Clock; reservas: ReservasConfig; ranking: RankingConfig };

const idSchema = z.object({ id: z.coerce.number().int().positive() });

const rectificacionSchema = z.object({
  variacion: z
    .number({ error: "Indica la variación del puntaje." })
    .int("La variación debe ser un número entero.")
    .min(-100, "La variación debe estar entre -100 y 100.")
    .max(100, "La variación debe estar entre -100 y 100.")
    .refine((v) => v !== 0, "La variación no puede ser cero."),
  motivo: z.string({ error: "Justifica la rectificación." }).trim().min(10, "Justifica la rectificación (al menos 10 caracteres).").max(500),
  reservaId: z.number().int().positive().nullish(),
});

const claveSchema = z.object({
  clave: z.string({ error: "Falta la clave de la solicitud (Idempotency-Key)." }).trim().min(8).max(100),
});

async function historial(db: Database, cuentaId: number, ranking: RankingConfig) {
  const ajustes = await db.ajusteRanking.findMany({
    where: { cuentaId },
    orderBy: [{ registradoEn: "desc" }, { id: "desc" }],
    take: 200,
    include: {
      reserva: { select: { id: true, inicio: true, fin: true, plaza: { select: { codigo: true, zona: { select: { nombre: true } } } } } },
      autorRectificacion: { select: { correo: true } },
    },
  });
  return {
    puntaje: await puntajeDe(db, cuentaId, ranking),
    puntajeInicial: ranking.puntajeInicial,
    ajustes: ajustes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      variacion: a.variacion,
      motivo: a.motivo,
      registradoEn: a.registradoEn,
      rectificadoPor: a.autorRectificacion?.correo ?? null,
      reserva: a.reserva
        ? {
            id: a.reserva.id,
            fecha: partesLocales(a.reserva.inicio).fecha,
            llegada: partesLocales(a.reserva.inicio).hora,
            salida: partesLocales(a.reserva.fin).hora,
            plaza: a.reserva.plaza.codigo,
            zona: a.reserva.plaza.zona.nombre,
          }
        : null,
    })),
  };
}

/** Puntaje, historial de ajustes y rectificaciones administrativas (05B). */
export function crearRutasRanking({ db, clock, reservas, ranking }: Deps) {
  const router = Router();
  const conSesion = requiereSesion(db, clock);
  const admin = [conSesion, requiereRol("admin")];

  router.get("/ranking", conSesion, async (_request, response) => {
    const datos = await historial(db, sesionDe(response).cuentaId, ranking);
    // La persona ve que el ajuste fue una rectificación administrativa, sin el correo de quien la hizo.
    response.json({ ...datos, ajustes: datos.ajustes.map((a) => ({ ...a, rectificadoPor: a.rectificadoPor ? "Administración" : null })) });
  });

  router.get("/admin/cuentas/:id/ranking", ...admin, async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    if (!(await db.cuenta.findUnique({ where: { id }, select: { id: true } }))) {
      throw new HttpError(404, "no_encontrado", "No encontramos esa cuenta.");
    }
    response.json(await historial(db, id, ranking));
  });

  /**
   * Rectificación justificada del puntaje. Es la única vía para sancionar un mal uso: requiere la
   * validación de una cuenta `admin` y queda registrada con su autor. La `Idempotency-Key` evita
   * duplicarla si se reintenta.
   */
  router.post("/admin/cuentas/:id/ranking/rectificaciones", ...admin, async (request, response) => {
    const { id: cuentaId } = parseInput(idSchema, request.params);
    const { clave } = parseInput(claveSchema, { clave: request.get("idempotency-key") });
    const datos = parseInput(rectificacionSchema, request.body);
    const autor = sesionDe(response).cuentaId;
    if (!(await db.cuenta.findUnique({ where: { id: cuentaId }, select: { id: true } }))) {
      throw new HttpError(404, "no_encontrado", "No encontramos esa cuenta.");
    }
    if (datos.reservaId && !(await db.reserva.findFirst({ where: { id: datos.reservaId, cuentaId }, select: { id: true } }))) {
      throw new HttpError(400, "datos_invalidos", "Revisa la rectificación.", { reservaId: "La reserva no es de esta cuenta." });
    }
    const claveOrigen = `rectificacion:${autor}:${clave}`;
    let creada = true;
    try {
      await db.ajusteRanking.create({
        data: {
          cuentaId,
          reservaId: datos.reservaId ?? null,
          autorRectificacionId: autor,
          tipo: "rectificacion",
          claveOrigen,
          variacion: datos.variacion,
          motivo: datos.motivo,
          registradoEn: clock(),
        },
      });
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
      creada = false;
    }
    response.status(creada ? 201 : 200).json(await historial(db, cuentaId, ranking));
  });

  /** Ejecuta ahora el proceso de ausencias y vencimientos (también corre periódicamente). */
  router.post("/admin/procesos/vencimientos", ...admin, async (_request, response) => {
    response.json(await procesarVencimientos(db, clock(), reservas, ranking));
  });

  return router;
}
