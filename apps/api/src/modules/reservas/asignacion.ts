import type { Clock } from "../../app.js";
import type { ReservasConfig } from "../../config.js";
import type { MetodoDistancia } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esViolacionUnica, restriccionDeExclusion } from "../../lib/prisma-errors.js";
import { partesLocales } from "../../lib/tiempo.js";
import type { VisitaValidada } from "../visitas/validacion.js";
import { incluirReserva, type ReservaConInclusiones } from "./presentacion.js";

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
 * Plazas regulares activas de bloques activos, abiertos durante toda la visita y sin reservas que
 * ocupen capacidad en el intervalo. Orden: primero distancias por la red peatonal y luego en línea
 * recta, por metros, por ID de bloque y por ID de plaza. Los bloques sin distancia quedan al final.
 */
export async function buscarCandidatas(db: Database, visita: VisitaValidada): Promise<Candidata[]> {
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

/** Devuelve la reserva ya creada con esta clave, si existe, comprobando que sea la misma solicitud. */
async function reservaDeReintento(db: Database, solicitud: Solicitud): Promise<ResultadoReserva | null> {
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

/**
 * Confirma una reserva en el bloque elegible más cercano al destino. Cada intento es un INSERT
 * atómico protegido por las restricciones de exclusión: si otra solicitud tomó la plaza entre la
 * búsqueda y la confirmación, se prueba la siguiente candidata (de ese u otro bloque).
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

  const { visita } = solicitud;
  const limite = new Date(clock().getTime() - config.toleranciaLlegadaMin * 60_000);
  if (visita.inicio < limite) {
    throw new HttpError(400, "datos_invalidos", "Revisa los datos de tu visita.", {
      llegada: "La hora de llegada ya pasó. Elige una hora futura.",
    });
  }

  const superpuesta = await db.reserva.findFirst({
    where: {
      OR: [{ cuentaId: solicitud.cuentaId }, { vehiculoId: solicitud.vehiculoId }],
      estado: { in: ["confirmada", "en_uso"] },
      inicio: { lt: visita.fin },
      fin: { gt: visita.inicio },
    },
    select: { id: true },
  });
  if (superpuesta) {
    throw new HttpError(409, "reserva_superpuesta", "Ya tienes una reserva que se superpone con ese horario.");
  }

  const candidatas = await buscarCandidatas(db, visita);
  const conDistancia = candidatas.filter((candidata) => candidata.metodo !== null && candidata.metros !== null);
  if (candidatas.length === 0) {
    throw sinCupo();
  }
  if (conDistancia.length === 0) {
    throw new HttpError(
      422,
      "sin_cercania",
      "Hay plazas disponibles, pero falta información de cercanía para ese destino. Elige otro destino o avisa a administración.",
    );
  }

  for (const candidata of conDistancia) {
    try {
      const reserva = await db.reserva.create({
        data: {
          cuentaId: solicitud.cuentaId,
          vehiculoId: solicitud.vehiculoId,
          plazaId: candidata.plazaId,
          destinoId: visita.destino.id,
          inicio: visita.inicio,
          fin: visita.fin,
          claveIdempotencia: solicitud.claveIdempotencia,
          metros: candidata.metros!,
          metodoDistancia: candidata.metodo!,
          creadaEn: clock(),
        },
        include: incluirReserva,
      });
      return { reserva, reintento: false };
    } catch (error) {
      const restriccion = restriccionDeExclusion(error);
      if (restriccion === "Reserva_sin_solape_plaza") {
        continue;
      }
      if (restriccion !== null || esViolacionUnica(error)) {
        // Un reintento simultáneo de la misma solicitud pudo confirmarse primero.
        const reintento = await reservaDeReintento(db, solicitud);
        if (reintento) {
          return reintento;
        }
        if (restriccion === "Reserva_sin_solape_cuenta" || restriccion === "Reserva_sin_solape_vehiculo") {
          throw new HttpError(409, "reserva_superpuesta", "Ya tienes una reserva que se superpone con ese horario.");
        }
      }
      throw error;
    }
  }
  throw sinCupo();
}
