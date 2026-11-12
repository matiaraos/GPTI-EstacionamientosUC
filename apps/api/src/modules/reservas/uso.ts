import type { Clock } from "../../app.js";
import type { ReservasConfig } from "../../config.js";
import type { TipoEvento } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/errors.js";
import { dentroDelPerimetro, esPoligono, type Poligono } from "../../lib/geo.js";
import type { Database } from "../../lib/prisma.js";
import { restriccionUnica } from "../../lib/prisma-errors.js";
import { partesLocales } from "../../lib/tiempo.js";
import { resolverQr } from "../catalogo/qr.js";
import { incluirReserva, type ReservaConInclusiones } from "./presentacion.js";

export type ResultadoUso = {
  reserva: ReservaConInclusiones;
  evento: { tipo: TipoEvento; registradoEn: Date };
  /** `true` si el evento ya estaba registrado y la operación solo se repitió. */
  repetido: boolean;
};

type Lectura = { cuentaId: number; reservaId: number; qr: unknown };

const hora = (instante: Date) => partesLocales(instante).hora;

async function perimetroVigente(db: Database, config: ReservasConfig): Promise<Poligono> {
  if (config.perimetroPrueba) {
    return config.perimetroPrueba;
  }
  const campus = await db.campus.findFirst({ orderBy: { id: "asc" } });
  if (!campus || !esPoligono(campus.perimetro)) {
    throw new HttpError(503, "sin_perimetro", "No hay un perímetro configurado para validar la llegada.");
  }
  return campus.perimetro;
}

/** Comprueba que la reserva sea de la cuenta y que el QR vigente corresponda a su plaza. */
async function validarLectura(db: Database, { cuentaId, reservaId, qr }: Lectura) {
  const reserva = await db.reserva.findFirst({ where: { id: reservaId, cuentaId }, include: incluirReserva });
  if (!reserva) {
    throw new HttpError(404, "reserva_no_encontrada", "No encontramos esa reserva.");
  }
  const leido = await resolverQr(db, qr);
  if (leido.plaza.id !== reserva.plazaId) {
    throw new HttpError(
      409,
      "qr_otra_plaza",
      `Este QR corresponde a la plaza ${leido.plaza.codigo} de ${leido.zona.nombre}. Tu plaza es ${reserva.plaza.codigo} de ${reserva.plaza.zona.nombre}.`,
    );
  }
  return { reserva, qrPlazaId: leido.qrId };
}

async function eventoExistente(db: Database, reservaId: number, tipo: TipoEvento): Promise<ResultadoUso | null> {
  const evento = await db.eventoReserva.findUnique({ where: { reservaId_tipo: { reservaId, tipo } } });
  if (!evento) {
    return null;
  }
  const reserva = await db.reserva.findUniqueOrThrow({ where: { id: reservaId }, include: incluirReserva });
  return { reserva, evento: { tipo, registradoEn: evento.registradoEn }, repetido: true };
}

const ocupado = (restriccion: string | null) => {
  if (restriccion === "Reserva_plaza_en_uso_key") {
    return new HttpError(
      409,
      "plaza_ocupada",
      "La plaza aún figura en uso por la reserva anterior. Avisa a administración para que la libere.",
    );
  }
  return new HttpError(409, "uso_activo", "Ya tienes otra reserva en uso. Registra su salida antes de entrar.");
};

/** Cambia el estado y registra el evento en la misma transacción. */
async function transicion(
  db: Database,
  clock: Clock,
  reservaId: number,
  qrPlazaId: number,
  tipo: TipoEvento,
): Promise<ResultadoUso | null> {
  const desde = tipo === "entrada" ? "confirmada" : "en_uso";
  const hacia = tipo === "entrada" ? "en_uso" : "finalizada";
  const registradoEn = clock();
  try {
    return await db.$transaction(async (tx) => {
      const { count } = await tx.reserva.updateMany({ where: { id: reservaId, estado: desde }, data: { estado: hacia } });
      if (count === 0) {
        return null;
      }
      await tx.eventoReserva.create({ data: { reservaId, tipo, qrPlazaId, registradoEn } });
      const reserva = await tx.reserva.findUniqueOrThrow({ where: { id: reservaId }, include: incluirReserva });
      return { reserva, evento: { tipo, registradoEn }, repetido: false };
    });
  } catch (error) {
    const restriccion = restriccionUnica(error);
    if (restriccion === null) {
      throw error;
    }
    // Una lectura repetida que llegó al mismo tiempo ya registró el evento.
    const previo = await eventoExistente(db, reservaId, tipo);
    if (previo) {
      return previo;
    }
    throw ocupado(restriccion);
  }
}

/**
 * Check-in: QR vigente de la plaza reservada, dentro de la ventana de llegada según el reloj del
 * servidor y con la ubicación dentro del perímetro. La ubicación no se guarda.
 */
export async function registrarEntrada(
  db: Database,
  clock: Clock,
  config: ReservasConfig,
  lectura: Lectura & { latitud: number; longitud: number },
): Promise<ResultadoUso> {
  const { reserva, qrPlazaId } = await validarLectura(db, lectura);
  const previo = await eventoExistente(db, reserva.id, "entrada");
  if (previo) {
    return previo;
  }
  if (reserva.estado !== "confirmada") {
    throw new HttpError(
      409,
      "reserva_no_activa",
      reserva.estado === "cancelada" ? "Esta reserva fue cancelada." : "Esta reserva ya terminó.",
    );
  }

  const ahora = clock();
  const tolerancia = config.toleranciaLlegadaMin * 60_000;
  const desde = new Date(reserva.inicio.getTime() - tolerancia);
  const hasta = new Date(reserva.inicio.getTime() + tolerancia);
  if (ahora < desde) {
    throw new HttpError(409, "fuera_de_ventana", `Aún es temprano. Puedes registrar tu llegada desde las ${hora(desde)}.`);
  }
  if (ahora > hasta) {
    throw new HttpError(409, "fuera_de_ventana", `Tu ventana de llegada terminó a las ${hora(hasta)}.`);
  }

  const perimetro = await perimetroVigente(db, config);
  if (!dentroDelPerimetro([lectura.longitud, lectura.latitud], perimetro, config.margenPerimetroM)) {
    throw new HttpError(403, "fuera_de_zona", "Tu ubicación está fuera del campus. Registra la llegada al estacionar.");
  }

  // Si otra lectura cambió el estado entre la validación y la transición, se informa su resultado.
  const resultado =
    (await transicion(db, clock, reserva.id, qrPlazaId, "entrada")) ?? (await eventoExistente(db, reserva.id, "entrada"));
  if (!resultado) {
    throw new HttpError(409, "reserva_no_activa", "La reserva cambió de estado. Revisa Mi reserva.");
  }
  return resultado;
}

/** Check-out: QR vigente de la plaza en uso. Libera la plaza y conserva el historial. */
export async function registrarSalida(db: Database, clock: Clock, lectura: Lectura): Promise<ResultadoUso> {
  const { reserva, qrPlazaId } = await validarLectura(db, lectura);
  const previo = await eventoExistente(db, reserva.id, "salida");
  if (previo) {
    return previo;
  }
  if (reserva.estado !== "en_uso") {
    throw new HttpError(
      409,
      "reserva_no_en_uso",
      reserva.estado === "confirmada"
        ? "Primero registra tu llegada."
        : reserva.estado === "cancelada"
          ? "Esta reserva fue cancelada."
          : "Esta reserva ya terminó.",
    );
  }
  // Si otra lectura cambió el estado entre la validación y la transición, se informa su resultado.
  const resultado =
    (await transicion(db, clock, reserva.id, qrPlazaId, "salida")) ?? (await eventoExistente(db, reserva.id, "salida"));
  if (!resultado) {
    throw new HttpError(409, "reserva_no_en_uso", "La reserva cambió de estado. Revisa Mi reserva.");
  }
  return resultado;
}
