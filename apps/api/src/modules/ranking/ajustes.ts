import type { RankingConfig } from "../../config.js";
import type { Prisma, TipoAjuste } from "../../generated/prisma/client.js";
import type { Database } from "../../lib/prisma.js";

type Cliente = Database | Prisma.TransactionClient;

/** Ajustes automáticos de una reserva. Las rectificaciones e incidentes los registra administración. */
type TipoAutomatico = Exclude<TipoAjuste, "rectificacion" | "incidente" | "revocacion_recurrente">;

export const MOTIVOS: Record<TipoAutomatico, string> = {
  ausencia: "No registraste la llegada dentro de la ventana de la reserva.",
  vencimiento: "No registraste la salida dentro del plazo de la reserva.",
  salida_tardia: "Registraste la salida después del plazo de la reserva.",
  salida_a_tiempo: "Registraste la salida a tiempo.",
};

export function variacionDe(tipo: TipoAutomatico, config: RankingConfig): number {
  return { ausencia: config.ausencia, vencimiento: config.vencimiento, salida_tardia: config.salidaTardia, salida_a_tiempo: config.salidaATiempo }[tipo];
}

/**
 * Registra el ajuste automático de una reserva una sola vez: la clave de origen es única, así que
 * repetir el proceso no lo duplica. Debe llamarse en la misma transacción que el cambio de estado.
 */
export async function ajustarPorReserva(
  tx: Prisma.TransactionClient,
  config: RankingConfig,
  reserva: { id: number; cuentaId: number },
  tipo: TipoAutomatico,
  registradoEn: Date,
) {
  await tx.ajusteRanking.createMany({
    data: [
      {
        cuentaId: reserva.cuentaId,
        reservaId: reserva.id,
        tipo,
        claveOrigen: `${tipo}:reserva:${reserva.id}`,
        variacion: variacionDe(tipo, config),
        motivo: MOTIVOS[tipo],
        registradoEn,
      },
    ],
    skipDuplicates: true,
  });
}

export async function puntajeDe(db: Cliente, cuentaId: number, config: RankingConfig): Promise<number> {
  const { _sum } = await db.ajusteRanking.aggregate({ where: { cuentaId }, _sum: { variacion: true } });
  return config.puntajeInicial + (_sum.variacion ?? 0);
}
