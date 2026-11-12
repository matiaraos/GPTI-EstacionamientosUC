import { apiRequest } from "./client";

export type AjusteRanking = {
  id: number;
  tipo: "ausencia" | "vencimiento" | "salida_a_tiempo" | "salida_tardia" | "rectificacion";
  variacion: number;
  motivo: string;
  registradoEn: string;
  rectificadoPor: string | null;
  reserva: { id: number; fecha: string; llegada: string; salida: string; plaza: string; zona: string } | null;
};

export function obtenerRanking(token: string) {
  return apiRequest<{ puntaje: number; puntajeInicial: number; ajustes: AjusteRanking[] }>("/ranking", { token });
}

export const TITULOS: Record<AjusteRanking["tipo"], string> = {
  ausencia: "Ausencia",
  vencimiento: "Salida vencida",
  salida_a_tiempo: "Salida a tiempo",
  salida_tardia: "Salida tardía",
  rectificacion: "Rectificación de administración",
};
