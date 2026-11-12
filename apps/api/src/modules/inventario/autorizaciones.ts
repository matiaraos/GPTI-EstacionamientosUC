import type { Prisma } from "../../generated/prisma/client.js";
import type { Database } from "../../lib/prisma.js";

type Cliente = Database | Prisma.TransactionClient;

export type EstadoAutorizacion = "vigente" | "vencida" | "revocada";

export function estadoAutorizacion(autorizacion: { vigenteHasta: Date; revocadaEn: Date | null }, ahora: Date): EstadoAutorizacion {
  if (autorizacion.revocadaEn) {
    return "revocada";
  }
  return autorizacion.vigenteHasta > ahora ? "vigente" : "vencida";
}

/**
 * Indica si la cuenta puede optar a plazas preferentes en `instante`. La API lo comprueba al asignar
 * (04B); una habilitación revocada o vencida deja de ser válida.
 */
export async function tieneAutorizacionVigente(db: Cliente, cuentaId: number, instante: Date): Promise<boolean> {
  const autorizacion = await db.autorizacionPreferente.findUnique({
    where: { cuentaId },
    select: { vigenteHasta: true, revocadaEn: true },
  });
  return autorizacion !== null && estadoAutorizacion(autorizacion, instante) === "vigente";
}
