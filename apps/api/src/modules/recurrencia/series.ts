import type { Clock } from "../../app.js";
import type { RankingConfig, RecurrenciaConfig, ReservasConfig } from "../../config.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esConflictoReintentable } from "../../lib/prisma-errors.js";
import { instanteLocal, partesLocales } from "../../lib/tiempo.js";
import { avisarCancelacion, registrarAviso } from "../avisos/registro.js";
import { puntajeDe } from "../ranking/ajustes.js";
import { asignarEnTransaccion, bloquearFechas } from "../reservas/asignacion.js";
import { incluirReserva } from "../reservas/presentacion.js";

type Tx = Prisma.TransactionClient;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
/** Fecha `AAAA-MM-DD` como `Date` de una columna `date` (medianoche UTC). */
export const comoFecha = (f: string) => new Date(`${f}T00:00:00.000Z`);
export const textoFecha = (d: Date) => d.toISOString().slice(0, 10);
export const sumarDias = (f: string, n: number) => textoFecha(new Date(comoFecha(f).getTime() + n * 86_400_000));
/** Lunes de la semana de una fecha local. */
export const lunesDe = (f: string) => sumarDias(f, -((comoFecha(f).getUTCDay() + 6) % 7));

export type BloqueSolicitado = { diaSemana: number; llegada: string; salida: string; destinoId?: number | null };

const ocurrencias = (serieId: number) => ({ bloqueSerie: { serieId } }) satisfies Prisma.ReservaWhereInput;

/** Serializa las decisiones sobre series de una zona (crear, renovar) para que no consuman el mismo cupo. */
async function bloquearZona(tx: Tx, zonaId: number) {
  await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`series:zona:${zonaId}`}))) AS bloqueo`;
}

/** Cupo de series de una zona: el tope es el porcentaje configurado de sus plazas activas, hacia abajo. */
export async function cupoZona(db: Database | Tx, zonaId: number, config: RecurrenciaConfig) {
  const plazas = await db.plaza.count({ where: { zonaId, activa: true } });
  const usadas = await db.serieReserva.count({ where: { zonaId, estado: "activa" } });
  return { plazas, tope: Math.floor((plazas * config.topePct) / 100), usadas };
}

/** Zona de las series: la zona piloto configurada o, sin ella, el bloque con plazas más cercano al destino. */
async function zonaDeSerie(db: Database, config: RecurrenciaConfig, destinoId: number) {
  if (config.zonaPiloto) {
    const zona = await db.zona.findUnique({ where: { idOrigen: config.zonaPiloto } });
    if (!zona || !zona.activa) throw new HttpError(503, "sin_zona_piloto", "La zona piloto de reservas semanales no está habilitada.");
    return zona;
  }
  const cercana = await db.cercaniaBloque.findFirst({
    where: { destinoId, zona: { activa: true, plazas: { some: { activa: true } } } },
    orderBy: [{ metodo: "asc" }, { metros: "asc" }, { zonaId: "asc" }],
    include: { zona: true },
  });
  if (!cercana) throw new HttpError(422, "sin_cercania", "No hay un bloque con distancia conocida a ese destino.");
  return cercana.zona;
}

type SerieConBloques = Prisma.SerieReservaGetPayload<{ include: { bloques: { include: { destino: { select: { id: true } } } } } }>;

/**
 * Crea las ocurrencias de una semana con la misma asignación por cercanía y control de conflictos que
 * una reserva diaria, en la zona de la serie. Las fechas que ya pasaron se omiten. Con `estricto`, una
 * ocurrencia sin plaza aborta todo; si no, se informa y se sigue.
 */
async function generarSemana(tx: Tx, clock: Clock, config: ReservasConfig, serie: SerieConBloques, lunes: string, estricto: boolean) {
  const creadas: number[] = [];
  const omitidas: { fecha: string; motivo: string }[] = [];
  const limite = new Date(clock().getTime() - config.toleranciaLlegadaMin * 60_000);
  for (const bloque of [...serie.bloques].sort((a, b) => a.diaSemana - b.diaSemana || a.inicioMinuto - b.inicioMinuto)) {
    const fecha = sumarDias(lunes, bloque.diaSemana - 1);
    const llegada = hhmm(bloque.inicioMinuto);
    const salida = hhmm(bloque.finMinuto);
    const inicio = instanteLocal(fecha, llegada);
    const fin = instanteLocal(fecha, salida);
    if (!inicio || !fin || inicio < limite) continue;
    await bloquearFechas(tx, [fecha]);
    // Un punto de guardado permite seguir con las demás fechas si una no tiene plaza.
    if (!estricto) await tx.$executeRawUnsafe(`SAVEPOINT ocurrencia`);
    try {
      const { reserva } = await asignarEnTransaccion(tx, clock, {
        cuentaId: serie.cuentaId,
        vehiculoId: serie.vehiculoId,
        claveIdempotencia: `serie:${bloque.id}:${fecha}`,
        visita: { fecha, llegada, salida, inicio, fin, origenDestino: "declarado", destino: bloque.destino, destinoDesempate: null },
        serie: { zonaId: serie.zonaId, bloqueSerieId: bloque.id, fechaOcurrencia: comoFecha(fecha) },
      });
      creadas.push(reserva.id);
      if (!estricto) await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ocurrencia`);
    } catch (error) {
      if (estricto || !(error instanceof HttpError)) {
        if (error instanceof HttpError && estricto) {
          throw new HttpError(error.status, error.code, `${fechaLegible(fecha)} ${llegada}–${salida}: ${error.message}`);
        }
        throw error;
      }
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ocurrencia`);
      omitidas.push({ fecha, motivo: error.message });
    }
  }
  return { creadas, omitidas };
}

const fechaLegible = (f: string) =>
  new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(comoFecha(f));

async function conReintentos<T>(operacion: () => Promise<T>): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await operacion();
    } catch (error) {
      if (!esConflictoReintentable(error) || intento >= 5) throw error;
      await new Promise((r) => setTimeout(r, Math.random() * 25 * intento));
    }
  }
}

/**
 * Crea una serie: verifica elegibilidad y límite de bloques, y en una transacción serializada por zona
 * comprueba el tope del 30 %, guarda la serie y genera las ocurrencias de la primera semana.
 */
export async function crearSerie(
  db: Database,
  clock: Clock,
  deps: { reservas: ReservasConfig; recurrencia: RecurrenciaConfig; ranking: RankingConfig },
  datos: { cuentaId: number; vehiculoId: number; bloques: BloqueSolicitado[]; semana?: string; clave: string },
) {
  const previa = await db.serieReserva.findUnique({ where: { cuentaId_claveIdempotencia: { cuentaId: datos.cuentaId, claveIdempotencia: datos.clave } } });
  if (previa) return { serieId: previa.id, reintento: true, omitidas: [] };

  const { recurrencia } = deps;
  const puntaje = await puntajeDe(db, datos.cuentaId, deps.ranking);
  if (puntaje < recurrencia.umbralPuntaje) {
    throw new HttpError(
      403,
      "no_elegible",
      `Las reservas semanales requieren al menos ${recurrencia.umbralPuntaje} puntos y tienes ${puntaje}. Puedes seguir reservando por día.`,
    );
  }
  const propias = await db.bloqueSerie.count({ where: { serie: { cuentaId: datos.cuentaId, estado: "activa" } } });
  if (propias + datos.bloques.length > recurrencia.maxBloques) {
    throw new HttpError(400, "datos_invalidos", "Revisa los bloques.", {
      bloques: `Puedes fijar hasta ${recurrencia.maxBloques} bloques semanales y ya tienes ${propias}.`,
    });
  }

  // Destino de cada bloque: el elegido o, si no hay, la primera clase de ese día dentro del bloque.
  const details: Record<string, string> = {};
  const bloques: { diaSemana: number; inicioMinuto: number; finMinuto: number; destinoId: number }[] = [];
  for (const [i, b] of datos.bloques.entries()) {
    const inicio = aMin(b.llegada);
    const fin = aMin(b.salida);
    if (fin <= inicio) {
      details[`bloques.${i}.salida`] = "La salida debe ser posterior a la llegada.";
      continue;
    }
    if (bloques.some((o) => o.diaSemana === b.diaSemana && o.inicioMinuto < fin && inicio < o.finMinuto)) {
      details[`bloques.${i}.llegada`] = "Se superpone con otro bloque del mismo día.";
      continue;
    }
    let destinoId = b.destinoId ?? null;
    if (destinoId && !(await db.destino.findFirst({ where: { id: destinoId, activo: true }, select: { id: true } }))) destinoId = null;
    if (!destinoId && !b.destinoId) {
      const clase = await db.bloqueClase.findFirst({
        where: { cuentaId: datos.cuentaId, diaSemana: b.diaSemana, inicioMinuto: { lt: fin }, finMinuto: { gt: inicio } },
        orderBy: { inicioMinuto: "asc" },
      });
      destinoId = clase?.destinoId ?? null;
    }
    if (!destinoId) {
      details[`bloques.${i}.destinoId`] = "Elige el destino o registra tus clases de ese día.";
      continue;
    }
    bloques.push({ diaSemana: b.diaSemana, inicioMinuto: inicio, finMinuto: fin, destinoId });
  }
  if (Object.keys(details).length > 0) throw new HttpError(400, "datos_invalidos", "Revisa los bloques.", details);

  const hoy = partesLocales(clock()).fecha;
  const lunes = datos.semana ? lunesDe(datos.semana) : sumarDias(lunesDe(hoy), 7);
  if (lunes < lunesDe(hoy)) {
    throw new HttpError(400, "datos_invalidos", "Revisa la semana.", { semana: "La semana ya pasó." });
  }
  const zona = await zonaDeSerie(db, recurrencia, bloques[0].destinoId);

  return conReintentos(() =>
    db.$transaction(
      async (tx) => {
        const repetida = await tx.serieReserva.findUnique({ where: { cuentaId_claveIdempotencia: { cuentaId: datos.cuentaId, claveIdempotencia: datos.clave } } });
        if (repetida) return { serieId: repetida.id, reintento: true, omitidas: [] };
        await bloquearZona(tx, zona.id);
        const cupo = await cupoZona(tx, zona.id, recurrencia);
        if (cupo.usadas >= cupo.tope) {
          throw new HttpError(
            409,
            "tope_recurrente",
            `${zona.nombre} ya tiene ${cupo.usadas} de ${cupo.tope} plazas para reservas semanales (${recurrencia.topePct} % de ${cupo.plazas}). Puedes seguir reservando por día.`,
          );
        }
        const serie = await tx.serieReserva.create({
          data: {
            cuentaId: datos.cuentaId,
            vehiculoId: datos.vehiculoId,
            zonaId: zona.id,
            claveIdempotencia: datos.clave,
            creadaEn: clock(),
            semanaHasta: comoFecha(lunes),
            bloques: { create: bloques },
          },
          include: { bloques: { include: { destino: { select: { id: true } } } } },
        });
        await generarSemana(tx, clock, deps.reservas, serie, lunes, true);
        return { serieId: serie.id, reintento: false, omitidas: [] };
      },
      { maxWait: 10_000, timeout: 20_000 },
    ),
  );
}

/** Cancela las ocurrencias futuras de una serie y libera sus plazas, con su aviso. */
async function cancelarFuturas(tx: Tx, serieId: number, ahora: Date, motivo: string) {
  const futuras = await tx.reserva.findMany({ where: { ...ocurrencias(serieId), estado: "confirmada", inicio: { gt: ahora } }, include: incluirReserva });
  for (const r of futuras) {
    await tx.reserva.update({ where: { id: r.id }, data: { estado: "cancelada", canceladaEn: ahora } });
    await avisarCancelacion(tx, { ...r, cuentaId: r.cuentaId }, ahora, motivo);
  }
  return futuras.length;
}

/**
 * Revoca el beneficio semanal (SC-001): cierra la serie, cancela sus ocurrencias futuras y aplica la
 * penalización adicional una sola vez. Se llama en la transacción que detecta el incumplimiento.
 */
export async function revocarSerie(tx: Tx, serieId: number, ahora: Date, motivo: string, ranking: RankingConfig) {
  const { count } = await tx.serieReserva.updateMany({
    where: { id: serieId, estado: "activa" },
    data: { estado: "revocada", cerradaEn: ahora, motivoCierre: motivo },
  });
  if (count === 0) return false;
  const serie = await tx.serieReserva.findUniqueOrThrow({ where: { id: serieId } });
  await cancelarFuturas(tx, serieId, ahora, "se revocó tu reserva semanal.");
  await tx.ajusteRanking.createMany({
    data: [
      {
        cuentaId: serie.cuentaId,
        tipo: "revocacion_recurrente",
        claveOrigen: `revocacion:serie:${serieId}`,
        variacion: ranking.revocacionRecurrente,
        motivo: `Reserva semanal revocada: ${motivo}`,
        registradoEn: ahora,
      },
    ],
    skipDuplicates: true,
  });
  await registrarAviso(tx, {
    cuentaId: serie.cuentaId,
    tipo: "cancelacion",
    clave: `revocacion:serie:${serieId}`,
    titulo: "Reserva semanal revocada",
    cuerpo: `${motivo} Se liberaron tus próximas fechas; puedes seguir reservando por día.`,
    ahora,
  });
  return true;
}

/** Cancelación de la serie por la persona: libera las ocurrencias futuras, sin penalización. */
export async function cancelarSerie(db: Database, clock: Clock, cuentaId: number, serieId: number) {
  return db.$transaction(async (tx) => {
    const ahora = clock();
    const { count } = await tx.serieReserva.updateMany({
      where: { id: serieId, cuentaId, estado: "activa" },
      data: { estado: "cancelada", cerradaEn: ahora, motivoCierre: "Cancelada por la persona." },
    });
    if (count === 0) {
      const serie = await tx.serieReserva.findFirst({ where: { id: serieId, cuentaId } });
      if (!serie) throw new HttpError(404, "serie_no_encontrada", "No encontramos esa reserva semanal.");
      return 0;
    }
    return cancelarFuturas(tx, serieId, ahora, "cancelaste tu reserva semanal.");
  });
}

export type ResultadoRenovacion = { renovadas: number[]; revocadas: number[]; omitidas: { serieId: number; fecha: string; motivo: string }[] };

/**
 * Renovación del fin de semana: revisa el cumplimiento de la última semana generada de cada serie
 * activa. Si hubo una ausencia o una salida vencida, la revoca; si se cumplió, genera la semana
 * siguiente. Es idempotente: la clave por (bloque, fecha) impide duplicar ocurrencias y `semanaHasta`
 * evita renovar dos veces. Solo actúa sábado y domingo, salvo que se fuerce.
 */
export async function procesarRenovaciones(
  db: Database,
  clock: Clock,
  deps: { reservas: ReservasConfig; ranking: RankingConfig },
  { forzar = false } = {},
): Promise<ResultadoRenovacion> {
  const resultado: ResultadoRenovacion = { renovadas: [], revocadas: [], omitidas: [] };
  const ahora = clock();
  const local = partesLocales(ahora);
  if (!forzar && local.diaSemana < 6) return resultado;
  const proxima = sumarDias(lunesDe(local.fecha), 7);
  const series = await db.serieReserva.findMany({ where: { estado: "activa", semanaHasta: { lt: comoFecha(proxima) } }, select: { id: true, zonaId: true } });
  for (const { id, zonaId } of series) {
    await conReintentos(() =>
      db.$transaction(
        async (tx) => {
          await bloquearZona(tx, zonaId);
          const serie = await tx.serieReserva.findFirst({
            where: { id, estado: "activa", semanaHasta: { lt: comoFecha(proxima) } },
            include: { bloques: { include: { destino: { select: { id: true } } } } },
          });
          if (!serie) return;
          const semana = textoFecha(serie.semanaHasta);
          const incumplida = await tx.reserva.findFirst({
            where: {
              ...ocurrencias(id),
              fechaOcurrencia: { gte: comoFecha(semana), lt: comoFecha(sumarDias(semana, 7)) },
              estado: { in: ["ausente", "vencida"] },
            },
            select: { estado: true },
          });
          if (incumplida) {
            const motivo = incumplida.estado === "ausente" ? "No registraste la llegada en una de tus fechas." : "No registraste la salida en una de tus fechas.";
            if (await revocarSerie(tx, id, ahora, motivo, deps.ranking)) resultado.revocadas.push(id);
            return;
          }
          const { omitidas } = await generarSemana(tx, clock, deps.reservas, serie, proxima, false);
          await tx.serieReserva.update({ where: { id }, data: { semanaHasta: comoFecha(proxima) } });
          resultado.renovadas.push(id);
          resultado.omitidas.push(...omitidas.map((o) => ({ serieId: id, ...o })));
        },
        { maxWait: 10_000, timeout: 20_000 },
      ),
    );
  }
  return resultado;
}

/** Programa la revisión cada hora; solo actúa el fin de semana. */
export function programarRenovaciones(db: Database, deps: { reservas: ReservasConfig; ranking: RankingConfig }, intervaloS = 3600) {
  const timer = setInterval(() => {
    procesarRenovaciones(db, () => new Date(), deps).catch((error) => console.error("No se pudieron renovar las series.", error));
  }, intervaloS * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
