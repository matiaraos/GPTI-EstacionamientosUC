import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { AuthConfig } from "../../config.js";
import type { Mailer } from "../../lib/correo.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { partesLocales } from "../../lib/tiempo.js";
import { parseInput } from "../../lib/validation.js";
import { normalizarCorreo } from "./normalizacion.js";
import { contrasenaNueva } from "./contrasena.js";
import { hashToken } from "./sesiones.js";

type Deps = { db: Database; clock: Clock; auth: AuthConfig; mailer: Mailer };

const solicitudSchema = z.object({
  correo: z.string({ error: "Ingresa tu correo." }).trim().min(1, "Ingresa tu correo.").transform(normalizarCorreo),
});

const confirmacionSchema = z.object({
  token: z.string({ error: "Abre el enlace que te enviamos por correo." }).trim().min(16, "El enlace no es válido."),
  contrasena: contrasenaNueva,
});

/** Respuesta pública de la solicitud: igual exista o no la cuenta, para no revelar qué correos están registrados. */
const RESPUESTA_SOLICITUD = {
  mensaje: "Si el correo corresponde a una cuenta, te enviamos un enlace para elegir una nueva contraseña.",
};

const enlaceInvalido = (motivo: "vencido" | "usado" | "desconocido") =>
  new HttpError(
    400,
    motivo === "vencido" ? "enlace_vencido" : motivo === "usado" ? "enlace_usado" : "enlace_invalido",
    motivo === "vencido"
      ? "El enlace venció. Solicita uno nuevo desde «¿Olvidaste tu contraseña?»."
      : motivo === "usado"
        ? "Este enlace ya se usó. Si no cambiaste tu contraseña, solicita uno nuevo."
        : "El enlace no es válido. Solicita uno nuevo desde «¿Olvidaste tu contraseña?».",
  );

function enlaceRecuperacion(base: string, token: string): string {
  const separador = base.includes("?") ? "&" : "?";
  return `${base}${separador}token=${encodeURIComponent(token)}`;
}

/** Solicitud y confirmación de recuperación de contraseña por correo (01B). */
export function crearRutasRecuperacion({ db, clock, auth, mailer }: Deps) {
  const router = Router();

  router.post("/auth/recuperacion", async (request, response) => {
    const { correo } = parseInput(solicitudSchema, request.body);
    const cuenta = await db.cuenta.findUnique({ where: { correo }, select: { id: true, activa: true } });
    if (cuenta?.activa) {
      const ahora = clock();
      const token = randomBytes(32).toString("base64url");
      const venceEn = new Date(ahora.getTime() + auth.recuperacionTtlMin * 60_000);
      await db.recuperacion.create({ data: { cuentaId: cuenta.id, hashToken: hashToken(token), creadaEn: ahora, venceEn } });
      const vence = partesLocales(venceEn);
      // El envío no se espera: así la respuesta tarda lo mismo exista o no la cuenta, y una falla del
      // canal no revela nada. La persona puede volver a solicitar el enlace.
      mailer
        .enviar({
          para: correo,
          asunto: "Recupera tu acceso a MiEstacionamientoUC",
          texto: [
            "Recibimos una solicitud para cambiar la contraseña de tu cuenta.",
            "",
            `Abre este enlace desde tu teléfono para elegir una nueva (vence a las ${vence.hora} del ${vence.fecha}):`,
            enlaceRecuperacion(auth.recuperacionUrl, token),
            "",
            "El enlace funciona una sola vez. Si no lo pediste, ignora este correo: tu contraseña no cambia.",
          ].join("\n"),
        })
        .catch((error: unknown) => console.error("No se pudo enviar el correo de recuperación.", error));
    }
    response.status(202).json(RESPUESTA_SOLICITUD);
  });

  /** Cambia la contraseña con un enlace vigente y no usado, y cierra todas las sesiones de la cuenta. */
  router.post("/auth/recuperacion/confirmar", async (request, response) => {
    const { token, contrasena } = parseInput(confirmacionSchema, request.body);
    const ahora = clock();
    const recuperacion = await db.recuperacion.findUnique({
      where: { hashToken: hashToken(token) },
      select: { id: true, cuentaId: true, venceEn: true, usadoEn: true, cuenta: { select: { activa: true } } },
    });
    if (!recuperacion || !recuperacion.cuenta.activa) {
      throw enlaceInvalido("desconocido");
    }
    if (recuperacion.usadoEn) {
      throw enlaceInvalido("usado");
    }
    if (recuperacion.venceEn <= ahora) {
      throw enlaceInvalido("vencido");
    }
    const hashContrasena = await bcrypt.hash(contrasena, auth.bcryptRounds);
    const cambiada = await db.$transaction(async (tx) => {
      // Consumir el enlace con una condición sobre `usadoEn` impide que dos confirmaciones simultáneas lo usen.
      const { count } = await tx.recuperacion.updateMany({
        where: { id: recuperacion.id, usadoEn: null },
        data: { usadoEn: ahora },
      });
      if (count === 0) {
        return false;
      }
      await tx.cuenta.update({ where: { id: recuperacion.cuentaId }, data: { hashContrasena } });
      // Los demás enlaces pendientes de la cuenta quedan anulados y las sesiones abiertas se cierran.
      await tx.recuperacion.updateMany({ where: { cuentaId: recuperacion.cuentaId, usadoEn: null }, data: { usadoEn: ahora } });
      await tx.sesion.updateMany({ where: { cuentaId: recuperacion.cuentaId, revocadaEn: null }, data: { revocadaEn: ahora } });
      return true;
    });
    if (!cambiada) {
      throw enlaceInvalido("usado");
    }
    response.json({ mensaje: "Tu contraseña se actualizó. Inicia sesión con la nueva contraseña." });
  });

  return router;
}
