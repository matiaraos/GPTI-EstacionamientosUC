import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { Database } from "../../lib/prisma.js";
import { parseInput } from "../../lib/validation.js";
import { requiereSesion, sesionDe } from "../cuentas/sesiones.js";

type Deps = { db: Database; clock: Clock };

const canalSchema = z.object({
  token: z.string({ error: "Falta el token del dispositivo." }).trim().regex(/^(Exponent|Expo)PushToken\[[^\]]+\]$/, "El token no es de Expo Push."),
  plataforma: z.enum(["android", "ios"], { error: "Indica la plataforma." }),
});

/** Bandeja de avisos de la persona y registro de dispositivos para notificaciones (06). */
export function crearRutasAvisos({ db, clock }: Deps) {
  const router = Router();
  router.use("/avisos", requiereSesion(db, clock));

  /**
   * Últimos avisos con su estado de entrega. Si una notificación no llega, la persona ve aquí el
   * resultado de su reserva.
   */
  router.get("/avisos", async (_request, response) => {
    const ahora = clock();
    const avisos = await db.aviso.findMany({
      where: { cuentaId: sesionDe(response).cuentaId, estado: { not: "cancelado" }, programadoEn: { lte: ahora } },
      orderBy: [{ programadoEn: "desc" }, { id: "desc" }],
      take: 50,
      select: { id: true, tipo: true, titulo: true, cuerpo: true, estado: true, canal: true, programadoEn: true, enviadoEn: true, reservaId: true },
    });
    const programados = await db.aviso.findMany({
      where: { cuentaId: sesionDe(response).cuentaId, estado: "pendiente", programadoEn: { gt: ahora } },
      orderBy: { programadoEn: "asc" },
      select: { id: true, tipo: true, titulo: true, programadoEn: true, reservaId: true },
    });
    response.json({ avisos, programados });
  });

  /** Registra o reactiva el token de Expo Push del dispositivo para la cuenta de la sesión. */
  router.post("/avisos/canales", async (request, response) => {
    const { token, plataforma } = parseInput(canalSchema, request.body);
    const cuentaId = sesionDe(response).cuentaId;
    // Un dispositivo pertenece a la última cuenta que inició sesión en él.
    await db.canalAviso.upsert({
      where: { token },
      create: { token, plataforma, cuentaId, actualizadoEn: clock() },
      update: { plataforma, cuentaId, activo: true, actualizadoEn: clock() },
    });
    response.status(204).end();
  });

  /** Deja de enviar notificaciones a este dispositivo (por ejemplo, al cerrar sesión). */
  router.delete("/avisos/canales", async (request, response) => {
    const { token } = parseInput(canalSchema.pick({ token: true }), request.body);
    await db.canalAviso.updateMany({ where: { token, cuentaId: sesionDe(response).cuentaId }, data: { activo: false } });
    response.status(204).end();
  });

  return router;
}
