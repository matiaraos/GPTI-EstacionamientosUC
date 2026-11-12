import type { Destino } from "./catalogo";
import { apiRequest } from "./client";

export type DatosVisita = { fecha: string; llegada: string; salida: string; destinoId: number | null };

export type VisitaValidada = {
  fecha: string;
  llegada: string;
  salida: string;
  inicio: string;
  fin: string;
  destino: Pick<Destino, "id" | "idOrigen" | "nombre" | "tipo">;
};

export function validarVisita(token: string, datos: DatosVisita) {
  return apiRequest<{ visita: VisitaValidada }>("/visitas/validar", { method: "POST", body: datos, token });
}
