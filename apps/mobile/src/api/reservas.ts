import type { Destino } from "./catalogo";
import { apiRequest } from "./client";

/** Fecha y horas de pared de Santiago, y el destino elegido. */
export type DatosVisita = { fecha: string; llegada: string; salida: string; destinoId: number | null };

export type Reserva = {
  id: number;
  estado: "confirmada" | "en_uso" | "finalizada" | "cancelada";
  inicio: string;
  fin: string;
  fecha: string;
  llegada: string;
  salida: string;
  plaza: { id: number; codigo: string };
  zona: { id: number; nombre: string };
  destino: Pick<Destino, "id" | "idOrigen" | "nombre" | "tipo">;
  vehiculo: { id: number; patente: string };
  metros: number;
  metodoDistancia: "peatonal" | "linea_recta";
};

/** La clave identifica la solicitud: reenviarla con la misma clave devuelve la misma reserva. */
export function solicitarReserva(token: string, datos: DatosVisita, clave: string) {
  return apiRequest<{ reserva: Reserva }>("/reservas", {
    method: "POST",
    body: datos,
    token,
    headers: { "Idempotency-Key": clave },
  });
}

export function reservasVigentes(token: string) {
  return apiRequest<{ reservas: Reserva[] }>("/reservas/vigentes", { token });
}

export function cancelarReserva(token: string, id: number) {
  return apiRequest<{ reserva: Reserva }>(`/reservas/${id}/cancelar`, { method: "POST", token });
}

export function nuevaClaveSolicitud(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** "240 m a pie" o "80 m en línea recta (estimación)". */
export function distanciaLegible(reserva: Pick<Reserva, "metros" | "metodoDistancia">): string {
  return reserva.metodoDistancia === "peatonal"
    ? `${reserva.metros} m a pie`
    : `${reserva.metros} m en línea recta (estimación)`;
}
