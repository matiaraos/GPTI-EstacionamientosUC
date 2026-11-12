import type { Clock } from "../../app.js";
import type { ReservasConfig } from "../../config.js";
import type { MetodoDistancia, Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esConflictoReintentable, esViolacionUnica, restriccionDeExclusion } from "../../lib/prisma-errors.js";
import { partesLocales } from "../../lib/tiempo.js";
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

const minutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Plazas regulares activas de bloques activos, abiertos durante toda la visita, sin bloqueos vigentes
 * y sin reservas que ocupen capacidad en el intervalo. Orden: primero distancias por la red peatonal y luego en línea
 * recta, por metros, por ID de bloque y por ID de plaza. Los bloques sin distancia quedan al final.
 */
export async function buscarCandidatas(db: Cliente, visita: VisitaValidada): Promise<Candidata[]> {
  const { diaSemana } = partesLocales(visita.inicio);
  return db.$queryRaw<Candidata[]>`
    SELECT p."id" AS "plazaId", z."id" AS "zonaId", c."metros", c."metodo"
    FROM "Plaza" p
    JOIN "Zona" z ON z."id" = p."zonaId" AND z."activa"
    JOIN "HorarioZona" h ON h."zonaId" = z."id"
      AND h."diaSemana" = ${diaSemana}
      AND h."abreMinuto" <= ${minutos(visita.llegada)}
      AND h."cierraMinuto" >= ${minutos(visita.salida)}
    LEFT JOIN "CercaniaBloque" c ON c."zonaId" = z."id" AND c."destinoId" = ${visita.destino.id}
    WHERE p."activa" AND p."tipo" = 'regular'
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
    ORDER BY c."metodo" NULLS LAST, c."metros" NULLS LAST, z."id", p."id"`;
}

type Solicitud = {
  cuentaId: number;
  vehiculoId: number;
  visita: VisitaValidada;
  claveIdempotencia: string;
};

export type ResultadoReserva = { reserva: ReservaConInclusiones; reintento: boolean };

const sinCupo = () =>
  new HttpError(409, "sin_cupo", "No hay plazas disponibles para ese horario. Prueba con otro horario o fecha.");

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

/** Busca la plaza y la confirma. Corre dentro de la transacción que tiene el bloqueo del día. */
async function asignarEnTransaccion(tx: Prisma.TransactionClient, clock: Clock, solicitud: Solicitud) {
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

  const candidatas = await buscarCandidatas(tx, visita);
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
      inicio: visita.inicio,
      fin: visita.fin,
      claveIdempotencia: solicitud.claveIdempotencia,
      metros: elegida.metros!,
      metodoDistancia: elegida.metodo!,
      creadaEn: clock(),
    },
    include: incluirReserva,
  });
  return { reserva, reintento: false };
}

/**
 * Confirma una reserva en el bloque elegible más cercano al destino.
 *
 * Las solicitudes de un mismo día se serializan con un bloqueo consultivo de PostgreSQL durante la
 * búsqueda y la inserción, que duran milisegundos. Así dos solicitudes simultáneas no eligen la misma
 * plaza ni se interbloquean en las restricciones de exclusión, que siguen garantizando en la base
 * que no haya solapes por plaza, cuenta o vehículo.
 */
export async function reservar(
  db: Database,
  clock: Clock,
  config: ReservasConfig,
  solicitud: Solicitud,
): Promise<ResultadoReserva> {
  const previa = await reservaDeReintento(db, solicitud);
  if (previa) {
    return previa;
  }

  const limite = new Date(clock().getTime() - config.toleranciaLlegadaMin * 60_000);
  if (solicitud.visita.inicio < limite) {
    throw new HttpError(400, "datos_invalidos", "Revisa los datos de tu visita.", {
      llegada: "La hora de llegada ya pasó. Elige una hora futura.",
    });
  }

  try {
    return await conReintentos(() =>
      db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`reservas:${solicitud.visita.fecha}`}))) AS bloqueo`;
          return asignarEnTransaccion(tx, clock, solicitud);
        },
        { maxWait: 10_000, timeout: 10_000 },
      ),
    );
  } catch (error) {
    // Defensa adicional: si una restricción de la base rechaza la inserción, se informa como conflicto.
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
}
