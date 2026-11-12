import type { Clock } from "../../app.js";
import type { ReservasConfig } from "../../config.js";
import type { MetodoDistancia, Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esConflictoReintentable, esViolacionUnica, restriccionDeExclusion } from "../../lib/prisma-errors.js";
import { partesLocales } from "../../lib/tiempo.js";
import { estadoAutorizacion } from "../inventario/autorizaciones.js";
import type { VisitaValidada } from "../visitas/validacion.js";
import { incluirReserva, type ReservaConInclusiones } from "./presentacion.js";

type Cliente = Database | Prisma.TransactionClient;

/** Plaza libre y elegible para toda la visita, con la cercanía de su bloque al destino. */
export type Candidata = {
  plazaId: number;
  zonaId: number;
  metros: number | null;
  metodo: MetodoDistancia | null;
};

/** Visita ya resuelta: intervalo, destino principal y, si hay clases, destino de desempate. */
export type VisitaAsignable = Pick<VisitaValidada, "fecha" | "llegada" | "salida" | "inicio" | "fin" | "origenDestino"> & {
  destino: { id: number };
  destinoDesempate: { id: number } | null;
};

const minutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Plazas activas de bloques activos, abiertos durante toda la visita, sin bloqueos vigentes y sin
 * reservas que ocupen capacidad en el intervalo. Las preferentes solo se incluyen con `preferente`.
 *
 * Orden: método al destino principal (red peatonal antes que línea recta) y metros; ante empate, el
 * mismo criterio hacia el destino de la última clase, con los bloques sin esa distancia al final;
 * luego ID de bloque. Dentro del bloque, una persona habilitada usa primero las preferentes para no
 * restar plazas regulares; después, ID de plaza. Los bloques sin distancia al destino quedan al final.
 */
export async function buscarCandidatas(db: Cliente, visita: VisitaAsignable, preferente = false): Promise<Candidata[]> {
  const { diaSemana } = partesLocales(visita.inicio);
  const tipos = preferente ? ["regular", "preferente"] : ["regular"];
  return db.$queryRaw<Candidata[]>`
    SELECT p."id" AS "plazaId", z."id" AS "zonaId", c."metros", c."metodo"
    FROM "Plaza" p
    JOIN "Zona" z ON z."id" = p."zonaId" AND z."activa"
    JOIN "HorarioZona" h ON h."zonaId" = z."id"
      AND h."diaSemana" = ${diaSemana}
      AND h."abreMinuto" <= ${minutos(visita.llegada)}
      AND h."cierraMinuto" >= ${minutos(visita.salida)}
    LEFT JOIN "CercaniaBloque" c ON c."zonaId" = z."id" AND c."destinoId" = ${visita.destino.id}
    LEFT JOIN "CercaniaBloque" d ON d."zonaId" = z."id" AND d."destinoId" = ${visita.destinoDesempate?.id ?? null}::int
    WHERE p."activa" AND p."tipo"::text = ANY(${tipos}::text[])
      AND NOT EXISTS (
        SELECT 1 FROM "BloqueoPlaza" b
        WHERE b."plazaId" = p."id"
          AND b."levantadoEn" IS NULL
          AND tstzrange(b."inicio", b."fin", '[)') && tstzrange(${visita.inicio}::timestamptz, ${visita.fin}::timestamptz, '[)')
      )
      AND NOT EXISTS (
        SELECT 1 FROM "Reserva" r
        WHERE r."plazaId" = p."id"
          AND r."estado" IN ('confirmada', 'en_uso')
          AND tstzrange(r."inicio", r."fin", '[)') && tstzrange(${visita.inicio}::timestamptz, ${visita.fin}::timestamptz, '[)')
      )
    ORDER BY c."metodo" NULLS LAST, c."metros" NULLS LAST,
      d."metodo" NULLS LAST, d."metros" NULLS LAST,
      z."id", (p."tipo" = 'preferente') DESC, p."id"`;
}

export type Solicitud = {
  cuentaId: number;
  vehiculoId: number;
  visita: VisitaAsignable;
  claveIdempotencia: string;
  /** Reserva original que se reemplaza en un cambio; ya debe estar cancelada en la misma transacción. */
  reemplazaId?: number;
  /** Solicitud de espera que se atiende; se marca asignada en la misma transacción. */
  esperaId?: number;
};

export type ResultadoReserva = { reserva: ReservaConInclusiones; reintento: boolean };

export const sinCupo = () =>
  new HttpError(409, "sin_cupo", "No hay plazas disponibles para ese horario. Puedes unirte a la lista de espera o probar otro horario.");

const superpuesta = () =>
  new HttpError(409, "reserva_superpuesta", "Ya tienes una reserva que se superpone con ese horario.");

/** Intentos ante conflictos transitorios de PostgreSQL (interbloqueo o serialización). */
const MAX_INTENTOS = 5;

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function conReintentos<T>(operacion: () => Promise<T>): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await operacion();
    } catch (error) {
      if (!esConflictoReintentable(error) || intento >= MAX_INTENTOS) {
        throw error;
      }
      await esperar(Math.random() * 25 * intento);
    }
  }
}

/** Devuelve la reserva ya creada con esta clave, si existe, comprobando que sea la misma solicitud. */
async function reservaDeReintento(db: Cliente, solicitud: Solicitud): Promise<ResultadoReserva | null> {
  const existente = await db.reserva.findUnique({
    where: { cuentaId_claveIdempotencia: { cuentaId: solicitud.cuentaId, claveIdempotencia: solicitud.claveIdempotencia } },
    include: incluirReserva,
  });
  if (!existente) {
    return null;
  }
  const misma =
    existente.destinoId === solicitud.visita.destino.id &&
    existente.vehiculoId === solicitud.vehiculoId &&
    existente.inicio.getTime() === solicitud.visita.inicio.getTime() &&
    existente.fin.getTime() === solicitud.visita.fin.getTime();
  if (!misma) {
    throw new HttpError(
      409,
      "clave_reutilizada",
      "Esta solicitud ya se usó con otros datos. Vuelve a enviar el formulario para crear una nueva.",
    );
  }
  return { reserva: existente, reintento: true };
}

/** La habilitación preferente debe estar vigente ahora y al inicio de la visita (SC-002). */
async function puedeUsarPreferentes(tx: Prisma.TransactionClient, cuentaId: number, ahora: Date, inicio: Date) {
  const autorizacion = await tx.autorizacionPreferente.findUnique({ where: { cuentaId }, select: { vigenteHasta: true, revocadaEn: true } });
  return (
    autorizacion !== null &&
    estadoAutorizacion(autorizacion, ahora) === "vigente" &&
    estadoAutorizacion(autorizacion, inicio) === "vigente"
  );
}

/** Serializa las asignaciones de las fechas indicadas, en orden fijo para no interbloquearse. */
export async function bloquearFechas(tx: Prisma.TransactionClient, fechas: string[]) {
  for (const fecha of [...new Set(fechas)].sort()) {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`reservas:${fecha}`}))) AS bloqueo`;
  }
}

/** Busca la plaza y la confirma. Corre dentro de la transacción que tiene el bloqueo del día. */
export async function asignarEnTransaccion(tx: Prisma.TransactionClient, clock: Clock, solicitud: Solicitud): Promise<ResultadoReserva> {
  const previa = await reservaDeReintento(tx, solicitud);
  if (previa) {
    return previa;
  }
  const { visita } = solicitud;
  const propia = await tx.reserva.findFirst({
    where: {
      OR: [{ cuentaId: solicitud.cuentaId }, { vehiculoId: solicitud.vehiculoId }],
      estado: { in: ["confirmada", "en_uso"] },
      inicio: { lt: visita.fin },
      fin: { gt: visita.inicio },
    },
    select: { id: true },
  });
  if (propia) {
    throw superpuesta();
  }

  const ahora = clock();
  const preferente = await puedeUsarPreferentes(tx, solicitud.cuentaId, ahora, visita.inicio);
  const candidatas = await buscarCandidatas(tx, visita, preferente);
  const elegida = candidatas.find((candidata) => candidata.metodo !== null && candidata.metros !== null);
  if (candidatas.length === 0) {
    throw sinCupo();
  }
  if (!elegida) {
    throw new HttpError(
      422,
      "sin_cercania",
      "Hay plazas disponibles, pero falta información de cercanía para ese destino. Elige otro destino o avisa a administración.",
    );
  }

  const reserva = await tx.reserva.create({
    data: {
      cuentaId: solicitud.cuentaId,
      vehiculoId: solicitud.vehiculoId,
      plazaId: elegida.plazaId,
      destinoId: visita.destino.id,
      destinoDesempateId: visita.destinoDesempate?.id ?? null,
      origenDestino: visita.origenDestino,
      inicio: visita.inicio,
      fin: visita.fin,
      claveIdempotencia: solicitud.claveIdempotencia,
      metros: elegida.metros!,
      metodoDistancia: elegida.metodo!,
      reemplazaId: solicitud.reemplazaId ?? null,
      creadaEn: ahora,
    },
    include: incluirReserva,
  });
  if (solicitud.esperaId) {
    // La espera se asigna una sola vez: si otra transacción ya la atendió o se canceló, se revierte todo.
    const { count } = await tx.solicitudEspera.updateMany({
      where: { id: solicitud.esperaId, estado: "pendiente" },
      data: { estado: "asignada", reservaId: reserva.id, cerradaEn: ahora },
    });
    if (count === 0) {
      throw new HttpError(409, "espera_cerrada", "La solicitud de espera ya no está pendiente.");
    }
  }
  return { reserva, reintento: false };
}

/** Traduce las violaciones de restricciones de la base en conflictos con mensaje. */
async function comoConflicto(db: Database, solicitud: Solicitud, error: unknown): Promise<ResultadoReserva> {
  const restriccion = restriccionDeExclusion(error);
  if (restriccion !== null || esViolacionUnica(error)) {
    const reintento = await reservaDeReintento(db, solicitud);
    if (reintento) {
      return reintento;
    }
    if (restriccion === "Reserva_sin_solape_plaza") {
      throw sinCupo();
    }
    throw superpuesta();
  }
  throw error;
}

export function validarLlegadaFutura(clock: Clock, config: ReservasConfig, inicio: Date) {
  const limite = new Date(clock().getTime() - config.toleranciaLlegadaMin * 60_000);
  if (inicio < limite) {
    throw new HttpError(400, "datos_invalidos", "Revisa los datos de tu visita.", {
      llegada: "La hora de llegada ya pasó. Elige una hora futura.",
    });
  }
}

/**
 * Confirma una reserva en el bloque elegible más cercano al destino.
 *
 * Las solicitudes de un mismo día se serializan con un bloqueo consultivo de PostgreSQL durante la
 * búsqueda y la inserción, que duran milisegundos. Así dos solicitudes simultáneas no eligen la misma
 * plaza ni se interbloquean en las restricciones de exclusión, que siguen garantizando en la base
 * que no haya solapes por plaza, cuenta o vehículo.
 */
export async function reservar(db: Database, clock: Clock, config: ReservasConfig, solicitud: Solicitud): Promise<ResultadoReserva> {
  const previa = await reservaDeReintento(db, solicitud);
  if (previa) {
    return previa;
  }
  validarLlegadaFutura(clock, config, solicitud.visita.inicio);
  try {
    return await conReintentos(() =>
      db.$transaction(
        async (tx) => {
          await bloquearFechas(tx, [solicitud.visita.fecha]);
          return asignarEnTransaccion(tx, clock, solicitud);
        },
        { maxWait: 10_000, timeout: 10_000 },
      ),
    );
  } catch (error) {
    return comoConflicto(db, solicitud, error);
  }
}

/**
 * Cambia una reserva confirmada por otra visita. En una sola transacción cancela la original y busca
 * la alternativa; si la alternativa falla, la transacción se revierte y la original se conserva.
 */
export async function cambiarReserva(
  db: Database,
  clock: Clock,
  config: ReservasConfig,
  { reservaId, ...solicitud }: Omit<Solicitud, "reemplazaId" | "esperaId"> & { reservaId: number },
): Promise<ResultadoReserva> {
  const nueva = { ...solicitud, reemplazaId: reservaId };
  const previa = await reservaDeReintento(db, nueva);
  if (previa) {
    return previa;
  }
  const original = await db.reserva.findFirst({ where: { id: reservaId, cuentaId: solicitud.cuentaId }, select: { estado: true, inicio: true } });
  if (!original) {
    throw new HttpError(404, "reserva_no_encontrada", "No encontramos esa reserva.");
  }
  if (original.estado !== "confirmada") {
    throw new HttpError(409, "reserva_no_modificable", "Solo puedes cambiar una reserva confirmada antes de registrar la llegada.");
  }
  validarLlegadaFutura(clock, config, solicitud.visita.inicio);
  try {
    return await conReintentos(() =>
      db.$transaction(
        async (tx) => {
          await bloquearFechas(tx, [partesLocales(original.inicio).fecha, solicitud.visita.fecha]);
          const { count } = await tx.reserva.updateMany({
            where: { id: reservaId, cuentaId: solicitud.cuentaId, estado: "confirmada" },
            data: { estado: "cancelada", canceladaEn: clock() },
          });
          if (count === 0) {
            throw new HttpError(409, "reserva_no_modificable", "La reserva cambió de estado. Revisa Mi reserva.");
          }
          return asignarEnTransaccion(tx, clock, nueva);
        },
        { maxWait: 10_000, timeout: 10_000 },
      ),
    );
  } catch (error) {
    return comoConflicto(db, nueva, error);
  }
}
