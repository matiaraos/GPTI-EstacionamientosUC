import { randomBytes } from "node:crypto";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";

/** Prefijo del contenido impreso en los QR de las plazas: `MEUC:<identificador>`. */
const PREFIJO = "MEUC:";
const FORMATO = /^MEUC:([A-Za-z0-9_-]{16,64})$/;

export function nuevoIdentificadorQr(): string {
  return randomBytes(16).toString("base64url");
}

export function contenidoQr(identificador: string): string {
  return `${PREFIJO}${identificador}`;
}

/** Plaza identificada por un QR vigente. */
export type PlazaDeQr = {
  qrId: number;
  plaza: { id: number; codigo: string; tipo: "regular" | "preferente"; activa: boolean };
  zona: { id: number; nombre: string };
};

/** Identifica la plaza a partir del texto leído en su QR. Rechaza QR ilegibles, desconocidos o revocados. */
export async function resolverQr(db: Database, contenido: unknown): Promise<PlazaDeQr> {
  const coincidencia = typeof contenido === "string" ? FORMATO.exec(contenido.trim()) : null;
  if (!coincidencia) {
    throw new HttpError(400, "qr_ilegible", "No reconocimos el código. Apunta la cámara al QR de la plaza e inténtalo de nuevo.");
  }
  const qr = await db.qrPlaza.findUnique({
    where: { identificador: coincidencia[1] },
    select: {
      id: true,
      revocadoEn: true,
      plaza: {
        select: { id: true, codigo: true, tipo: true, activa: true, zona: { select: { id: true, nombre: true } } },
      },
    },
  });
  if (!qr) {
    throw new HttpError(404, "qr_desconocido", "Este código QR no corresponde a una plaza del sistema.");
  }
  if (qr.revocadoEn) {
    throw new HttpError(409, "qr_revocado", "Este código QR fue reemplazado. Usa el QR vigente de la plaza.");
  }
  const { zona, ...plaza } = qr.plaza;
  return { qrId: qr.id, plaza, zona };
}
