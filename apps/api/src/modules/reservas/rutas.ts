import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { ReservasConfig } from "../../config.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { parseInput } from "../../lib/validation.js";
import { requiereSesion, sesionDe } from "../cuentas/sesiones.js";
import { validarVisita, visitaSchema } from "../visitas/validacion.js";
import { reservar } from "./asignacion.js";
import { incluirReserva, reservaPublica } from "./presentacion.js";

type Deps = { db: Database; clock: Clock; config: ReservasConfig };

const claveSchema = z
  .string({ error: "Falta la clave de la solicitud (Idempotency-Key)." })
  .trim()
  .min(8, "La clave de la solicitud debe tener al menos 8 caracteres.")
  .max(100, "La clave de la solicitud es demasiado larga.");

const idSchema = z.object({ id: z.coerce.number().int().positive() });

export function crearRutasReservas({ db, clock, config }: Deps) {
  const router = Router();
  router.use("/reservas", requiereSesion(db, clock));

  /**
   * Solicita una plaza para la visita. La cabecera `Idempotency-Key` identifica la solicitud: un
   * reintento con la misma clave y los mismos datos devuelve la misma reserva (200).
   */
  router.post("/reservas", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const claveIdempotencia = parseInput(z.object({ clave: claveSchema }), { clave: request.get("idempotency-key") }).clave;
    const datos = parseInput(visitaSchema.extend({ vehiculoId: z.coerce.number().int().positive().optional() }), request.body);

    const vehiculo = await db.vehiculo.findFirst({
      where: { cuentaId, ...(datos.vehiculoId && { id: datos.vehiculoId }) },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!vehiculo) {
      throw new HttpError(400, "datos_invalidos", "Revisa los datos de tu visita.", {
        vehiculoId: "Registra un vehículo en tu cuenta antes de reservar.",
      });
    }

    const visita = await validarVisita(db, datos);
    const { reserva, reintento } = await reservar(db, clock, config, {
      cuentaId,
      vehiculoId: vehiculo.id,
      visita,
      claveIdempotencia,
    });
    response.status(reintento ? 200 : 201).json({ reserva: reservaPublica(reserva) });
  });

  /** Reservas que aún ocupan capacidad y no han terminado, de la más próxima a la más lejana. */
  router.get("/reservas/vigentes", async (_request, response) => {
    const reservas = await db.reserva.findMany({
      where: { cuentaId: sesionDe(response).cuentaId, estado: { in: ["confirmada", "en_uso"] }, fin: { gt: clock() } },
      orderBy: { inicio: "asc" },
      include: incluirReserva,
    });
    response.json({ reservas: reservas.map(reservaPublica) });
  });

  router.get("/reservas/:id", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const reserva = await db.reserva.findFirst({ where: { id, cuentaId: sesionDe(response).cuentaId }, include: incluirReserva });
    if (!reserva) {
      throw new HttpError(404, "reserva_no_encontrada", "No encontramos esa reserva.");
    }
    response.json({ reserva: reservaPublica(reserva) });
  });

  /** Cancela una reserva antes del check-in y libera su intervalo. Repetirla no tiene efecto adicional. */
  router.post("/reservas/:id/cancelar", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    const { cuentaId } = sesionDe(response);
    await db.reserva.updateMany({
      where: { id, cuentaId, estado: "confirmada" },
      data: { estado: "cancelada", canceladaEn: clock() },
    });
    const reserva = await db.reserva.findFirst({ where: { id, cuentaId }, include: incluirReserva });
    if (!reserva) {
      throw new HttpError(404, "reserva_no_encontrada", "No encontramos esa reserva.");
    }
    if (reserva.estado !== "cancelada") {
      throw new HttpError(
        409,
        "reserva_no_cancelable",
        reserva.estado === "en_uso"
          ? "Ya registraste tu llegada. Para liberar la plaza, registra tu salida."
          : "Esta reserva ya terminó y no se puede cancelar.",
      );
    }
    response.json({ reserva: reservaPublica(reserva) });
  });

  return router;
}
