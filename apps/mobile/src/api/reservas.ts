import type { Destino } from "./catalogo";
import { apiRequest } from "./client";

/** Fecha y horas de pared de Santiago, y el destino elegido. */
export type DatosVisita = { fecha: string; llegada: string; salida: string; destinoId: number | null };

export type Reserva = {
  id: number;
  estado: "confirmada" | "en_uso" | "finalizada" | "cancelada" | "ausente" | "vencida";
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
  origenDestino?: "horario" | "declarado";
  reemplazaId?: number | null;
};

export type Espera = {
  id: number;
  estado: "pendiente" | "asignada" | "cancelada" | "vencida";
  fecha: string;
  llegada: string;
  salida: string;
  destino: Pick<Destino, "id" | "idOrigen" | "nombre" | "tipo">;
  reservaId: number | null;
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

export type ResultadoUso = { reserva: Reserva; evento: { tipo: "entrada" | "salida"; registradoEn: string } };

/** Check-in con el contenido del QR y la ubicación actual (la API no la guarda). */
export function registrarEntrada(token: string, id: number, datos: { qr: string; latitud: number; longitud: number }) {
  return apiRequest<ResultadoUso>(`/reservas/${id}/entrada`, { method: "POST", body: datos, token });
}

export function registrarSalida(token: string, id: number, qr: string) {
  return apiRequest<ResultadoUso>(`/reservas/${id}/salida`, { method: "POST", body: { qr }, token });
}

export function obtenerReserva(token: string, id: number) {
  return apiRequest<{ reserva: Reserva }>(`/reservas/${id}`, { token });
}

/** Cambia una reserva confirmada. Si la alternativa falla, la API conserva la original. */
export function cambiarReserva(token: string, id: number, datos: DatosVisita, clave: string) {
  return apiRequest<{ reserva: Reserva }>(`/reservas/${id}/cambiar`, {
    method: "POST",
    body: datos,
    token,
    headers: { "Idempotency-Key": clave },
  });
}

/** Lista de espera: requiere el consentimiento explícito de la persona. */
export function unirseAEspera(token: string, datos: DatosVisita, clave: string) {
  return apiRequest<{ espera: Espera }>("/esperas", {
    method: "POST",
    body: { ...datos, consentimiento: true },
    token,
    headers: { "Idempotency-Key": clave },
  });
}

export function misEsperas(token: string) {
  return apiRequest<{ esperas: Espera[] }>("/esperas", { token });
}

export function cancelarEspera(token: string, id: number) {
  return apiRequest<{ espera: Espera }>(`/esperas/${id}/cancelar`, { method: "POST", token });
}
