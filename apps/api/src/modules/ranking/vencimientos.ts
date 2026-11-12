import type { ReservasConfig, RankingConfig } from "../../config.js";
import type { Database } from "../../lib/prisma.js";
import { ajustarPorReserva } from "./ajustes.js";

export type ResultadoVencimientos = { ausentes: number[]; vencidas: number[] };

/**
 * Marca `ausente` las reservas confirmadas cuya ventana de llegada terminó sin check-in, y `vencida`
 * las que siguen en uso pasado el plazo de salida. Ambas liberan la capacidad. Cada cambio de estado
 * y su ajuste de ranking se registran en la misma transacción; repetir el proceso no tiene efecto.
 */
export async function procesarVencimientos(
  db: Database,
  ahora: Date,
  reservas: Pick<ReservasConfig, "toleranciaLlegadaMin" | "toleranciaSalidaMin">,
  ranking: RankingConfig,
): Promise<ResultadoVencimientos> {
  const limiteLlegada = new Date(ahora.getTime() - reservas.toleranciaLlegadaMin * 60_000);
  const limiteSalida = new Date(ahora.getTime() - reservas.toleranciaSalidaMin * 60_000);
  const resultado: ResultadoVencimientos = { ausentes: [], vencidas: [] };

  const candidatas = await db.reserva.findMany({
    where: {
      OR: [
        { estado: "confirmada", inicio: { lt: limiteLlegada } },
        { estado: "en_uso", fin: { lt: limiteSalida } },
      ],
    },
    select: { id: true, cuentaId: true, estado: true },
    orderBy: { id: "asc" },
    take: 500,
  });

  for (const reserva of candidatas) {
    const ausencia = reserva.estado === "confirmada";
    const cambiada = await db.$transaction(async (tx) => {
      // La condición sobre el estado evita pisar un check-in o check-out que llegó entretanto.
      const { count } = await tx.reserva.updateMany({
        where: ausencia
          ? { id: reserva.id, estado: "confirmada", inicio: { lt: limiteLlegada } }
          : { id: reserva.id, estado: "en_uso", fin: { lt: limiteSalida } },
        data: { estado: ausencia ? "ausente" : "vencida", vencidaEn: ahora },
      });
      if (count === 0) return false;
      await ajustarPorReserva(tx, ranking, reserva, ausencia ? "ausencia" : "vencimiento", ahora);
      return true;
    });
    if (cambiada) (ausencia ? resultado.ausentes : resultado.vencidas).push(reserva.id);
  }
  return resultado;
}

/** Ejecuta el proceso cada `intervaloS` segundos dentro del proceso de la API. */
export function programarVencimientos(
  db: Database,
  reservas: ReservasConfig,
  ranking: RankingConfig,
  intervaloS: number,
): () => void {
  if (intervaloS <= 0) return () => undefined;
  let enCurso = false;
  const timer = setInterval(async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      const { ausentes, vencidas } = await procesarVencimientos(db, new Date(), reservas, ranking);
      if (ausentes.length || vencidas.length) {
        console.log(`Vencimientos: ${ausentes.length} ausencias, ${vencidas.length} salidas vencidas.`);
      }
    } catch (error) {
      console.error("No se pudieron procesar los vencimientos.", error);
    } finally {
      enCurso = false;
    }
  }, intervaloS * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
