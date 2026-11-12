import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler, Response } from "express";
import type { Clock } from "../../app.js";
import type { Rol } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";

export type SesionActiva = {
  sesionId: number;
  cuentaId: number;
  rol: Rol;
};

declare global {
  namespace Express {
    interface Locals {
      sesion?: SesionActiva;
    }
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Crea una sesión y devuelve el token en claro, que solo conoce el cliente. */
export async function crearSesion(db: Database, cuentaId: number, ahora: Date, ttlHoras: number) {
  const token = randomBytes(32).toString("base64url");
  const venceEn = new Date(ahora.getTime() + ttlHoras * 3_600_000);
  await db.sesion.create({ data: { cuentaId, hashToken: hashToken(token), creadaEn: ahora, venceEn } });
  return { token, venceEn };
}

const sesionInvalida = () =>
  new HttpError(401, "sesion_invalida", "Tu sesión no es válida o expiró. Inicia sesión nuevamente.");

/** Exige un token `Bearer` de una sesión vigente, no revocada y de una cuenta activa. */
export function requiereSesion(db: Database, clock: Clock): RequestHandler {
  return async (request, response, next) => {
    const [scheme, token] = request.get("authorization")?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw sesionInvalida();
    }
    const sesion = await db.sesion.findUnique({
      where: { hashToken: hashToken(token) },
      select: { id: true, venceEn: true, revocadaEn: true, cuenta: { select: { id: true, rol: true, activa: true } } },
    });
    if (!sesion || sesion.revocadaEn || sesion.venceEn <= clock() || !sesion.cuenta.activa) {
      throw sesionInvalida();
    }
    response.locals.sesion = { sesionId: sesion.id, cuentaId: sesion.cuenta.id, rol: sesion.cuenta.rol };
    next();
  };
}

/** Debe ir después de `requiereSesion`. */
export function requiereRol(rol: Rol): RequestHandler {
  return (_request, response, next) => {
    if (sesionDe(response).rol !== rol) {
      throw new HttpError(403, "acceso_denegado", "Tu cuenta no tiene permiso para realizar esta operación.");
    }
    next();
  };
}

export function sesionDe(response: Response): SesionActiva {
  const sesion = response.locals.sesion;
  if (!sesion) {
    throw sesionInvalida();
  }
  return sesion;
}
