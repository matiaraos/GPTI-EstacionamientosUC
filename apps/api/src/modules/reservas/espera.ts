import type { Clock } from "../../app.js";
import type { RankingConfig, ReservasConfig } from "../../config.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esViolacionUnica, restriccionDeExclusion } from "../../lib/prisma-errors.js";
import { partesLocales } from "../../lib/tiempo.js";
import type { VisitaValidada } from "../visitas/validacion.js";
import { reservar } from "./asignacion.js";

export const incluirEspera = {
  destino: { select: { id: true, idOrigen: true, nombre: true, tipo: true } },
  reserva: { select: { id: true, estado: true } },
} as const;

type EsperaConInclusiones = {
  id: number;
  estado: string;
  inicio: Date;
  fin: Date;
  aceptadaEn: Date;
  cerradaEn: Date | null;
  destino: { id: number; idOrigen: string; nombre: string; tipo: "sala" | "edificio" };
  reserva: { id: number; estado: string } | null;
};

export function esperaPublica(e: EsperaConInclusiones) {
  const inicio = partesLocales(e.inicio);
  return {
    id: e.id,
    estado: e.estado,
    fecha: inicio.fecha,
    llegada: inicio.hora,
    salida: partesLocales(e.fin).hora,
    destino: e.destino,
    aceptadaEn: e.aceptadaEn,
    cerradaEn: e.cerradaEn,
    reservaId: e.reserva?.id ?? null,
  };
}

/** Registra la espera solo con consentimiento explícito. Un reintento con la misma clave la devuelve. */
export async function crearEspera(
  db: Database,
  clock: Clock,
  datos: { cuentaId: number; vehiculoId: number; visita: VisitaValidada; claveIdempotencia: string },
) {
  const previa = await db.solicitudEspera.findUnique({
    where: { cuentaId_claveIdempotencia: { cuentaId: datos.cuentaId, claveIdempotencia: datos.claveIdempotencia } },
    include: incluirEspera,
  });
  if (previa) return { espera: previa, reintento: true };
  try {
    const espera = await db.solicitudEspera.create({
      data: {
        cuentaId: datos.cuentaId,
        vehiculoId: datos.vehiculoId,
        destinoId: datos.visita.destino.id,
        destinoDesempateId: datos.visita.destinoDesempate?.id ?? null,
        origenDestino: datos.visita.origenDestino,
        inicio: datos.visita.inicio,
        fin: datos.visita.fin,
        aceptadaEn: clock(),
        claveIdempotencia: datos.claveIdempotencia,
      },
      include: incluirEspera,
    });
    return { espera, reintento: false };
  } catch (error) {
    if (restriccionDeExclusion(error) !== null) {
      throw new HttpError(409, "espera_superpuesta", "Ya estás en la lista de espera para un horario que se superpone.");
    }
    if (esViolacionUnica(error)) {
      const repetida = await db.solicitudEspera.findUniqueOrThrow({
        where: { cuentaId_claveIdempotencia: { cuentaId: datos.cuentaId, claveIdempotencia: datos.claveIdempotencia } },
        include: incluirEspera,
      });
      return { espera: repetida, reintento: true };
    }
    throw error;
  }
}

export type ResultadoEsperas = { asignadas: { esperaId: number; reservaId: number }[]; vencidas: number[] };

/**
 * Atiende la lista de espera tras liberarse capacidad: recorre las solicitudes pendientes por ranking
 * descendente y antigüedad, y asigna la primera compatible con la capacidad libre (y las siguientes,
 * si queda). La asignación de cada espera ocurre una sola vez, en la misma transacción que la reserva.
 * Las esperas cuya ventana de llegada ya pasó se cierran como vencidas.
 */
export async function atenderEsperas(
  db: Database,
  clock: Clock,
  config: ReservasConfig,
  ranking: RankingConfig,
): Promise<ResultadoEsperas> {
  const ahora = clock();
  const limite = new Date(ahora.getTime() - config.toleranciaLlegadaMin * 60_000);
  const vencidas = await db.solicitudEspera.findMany({ where: { estado: "pendiente", inicio: { lt: limite } }, select: { id: true } });
  if (vencidas.length) {
    await db.solicitudEspera.updateMany({
      where: { id: { in: vencidas.map((v) => v.id) }, estado: "pendiente" },
      data: { estado: "vencida", cerradaEn: ahora },
    });
  }

  const pendientes = await db.solicitudEspera.findMany({
    where: { estado: "pendiente" },
    include: { destino: { select: { id: true } } },
    orderBy: [{ aceptadaEn: "asc" }, { id: "asc" }],
    take: 200,
  });
  if (pendientes.length === 0) return { asignadas: [], vencidas: vencidas.map((v) => v.id) };
  const sumas = await db.ajusteRanking.groupBy({
    by: ["cuentaId"],
    where: { cuentaId: { in: pendientes.map((p) => p.cuentaId) } },
    _sum: { variacion: true },
  });
  const puntaje = new Map(sumas.map((s) => [s.cuentaId, ranking.puntajeInicial + (s._sum.variacion ?? 0)]));
  const ordenadas = [...pendientes].sort(
    (a, b) =>
      (puntaje.get(b.cuentaId) ?? ranking.puntajeInicial) - (puntaje.get(a.cuentaId) ?? ranking.puntajeInicial) ||
      a.aceptadaEn.getTime() - b.aceptadaEn.getTime() ||
      a.id - b.id,
  );

  const asignadas: ResultadoEsperas["asignadas"] = [];
  for (const espera of ordenadas) {
    const inicio = partesLocales(espera.inicio);
    try {
      const { reserva } = await reservar(db, clock, config, {
        cuentaId: espera.cuentaId,
        vehiculoId: espera.vehiculoId,
        claveIdempotencia: `espera:${espera.id}`,
        esperaId: espera.id,
        visita: {
          fecha: inicio.fecha,
          llegada: inicio.hora,
          salida: partesLocales(espera.fin).hora,
          inicio: espera.inicio,
          fin: espera.fin,
          origenDestino: espera.origenDestino,
          destino: { id: espera.destinoId },
          destinoDesempate: espera.destinoDesempateId ? { id: espera.destinoDesempateId } : null,
        },
      });
      asignadas.push({ esperaId: espera.id, reservaId: reserva.id });
    } catch (error) {
      // Sin capacidad compatible para esta solicitud: se sigue con la siguiente.
      if (!(error instanceof HttpError)) throw error;
    }
  }
  return { asignadas, vencidas: vencidas.map((v) => v.id) };
}
