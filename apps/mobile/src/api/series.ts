import type { Destino } from "./catalogo";
import { apiRequest } from "./client";
import type { Reserva } from "./reservas";

export type Serie = {
  id: number;
  estado: "activa" | "revocada" | "cancelada";
  zona: { id: number; nombre: string };
  creadaEn: string;
  semanaHasta: string;
  motivoCierre: string | null;
  bloques: { id: number; diaSemana: number; llegada: string; salida: string; destino: Pick<Destino, "id" | "idOrigen" | "nombre" | "tipo"> }[];
  ocurrencias: Reserva[];
};

export type Elegibilidad = {
  elegible: boolean;
  puntaje: number;
  umbral: number;
  bloques: { usados: number; maximo: number };
  zona: { id: number; nombre: string; plazas: number; tope: number; usadas: number; porcentaje: number } | null;
};

export type BloqueSerieNuevo = { diaSemana: number; llegada: string; salida: string; destinoId: number | null };

export function misSeries(token: string) {
  return apiRequest<{ series: Serie[] }>("/series", { token });
}

export function elegibilidadSerie(token: string) {
  return apiRequest<Elegibilidad>("/series/elegibilidad", { token });
}

export function crearSerie(token: string, bloques: BloqueSerieNuevo[], clave: string) {
  return apiRequest<{ serie: { id: number } }>("/series", { method: "POST", body: { bloques }, token, headers: { "Idempotency-Key": clave }, timeoutMs: 20_000 });
}

export function cancelarSerie(token: string, id: number) {
  return apiRequest<{ liberadas: number }>(`/series/${id}/cancelar`, { method: "POST", token });
}
