import type { Prisma } from "../../generated/prisma/client.js";
import { partesLocales } from "../../lib/tiempo.js";

export const incluirReserva = {
  plaza: { select: { id: true, codigo: true, zona: { select: { id: true, nombre: true } } } },
  destino: { select: { id: true, idOrigen: true, nombre: true, tipo: true } },
  vehiculo: { select: { id: true, patente: true } },
} satisfies Prisma.ReservaInclude;

export type ReservaConInclusiones = Prisma.ReservaGetPayload<{ include: typeof incluirReserva }>;

/** Forma pública de una reserva, con el horario también en hora local de Santiago. */
export function reservaPublica(reserva: ReservaConInclusiones) {
  const inicio = partesLocales(reserva.inicio);
  const fin = partesLocales(reserva.fin);
  return {
    id: reserva.id,
    estado: reserva.estado,
    inicio: reserva.inicio,
    fin: reserva.fin,
    fecha: inicio.fecha,
    llegada: inicio.hora,
    salida: fin.hora,
    plaza: { id: reserva.plaza.id, codigo: reserva.plaza.codigo },
    zona: reserva.plaza.zona,
    destino: reserva.destino,
    vehiculo: reserva.vehiculo,
    metros: reserva.metros,
    metodoDistancia: reserva.metodoDistancia,
    creadaEn: reserva.creadaEn,
    canceladaEn: reserva.canceladaEn,
    origenDestino: reserva.origenDestino,
    reemplazaId: reserva.reemplazaId,
  };
}
