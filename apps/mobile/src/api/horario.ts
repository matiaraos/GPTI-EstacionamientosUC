import type { Destino } from "./catalogo";
import { apiRequest } from "./client";

export type BloqueClase = {
  id: number;
  /** 1 = lunes … 7 = domingo. */
  diaSemana: number;
  inicio: string;
  fin: string;
  titulo: string | null;
  destino: Destino;
};

export type DatosBloque = { diaSemana: number; inicio: string; fin: string; destinoId: number | null; titulo?: string | null };

export type BloqueImportado = {
  diaSemana: number;
  inicio: string;
  fin: string;
  titulo: string | null;
  ubicacion: string | null;
  destino: Destino | null;
  coincidencias: Destino[];
  problemas: string[];
};

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

export function obtenerHorario(token: string) {
  return apiRequest<{ bloques: BloqueClase[] }>("/horario", { token });
}

export function crearBloque(token: string, datos: DatosBloque) {
  return apiRequest<{ bloque: BloqueClase }>("/horario/bloques", { method: "POST", body: datos, token });
}

export function editarBloque(token: string, id: number, datos: DatosBloque) {
  return apiRequest<{ bloque: BloqueClase }>(`/horario/bloques/${id}`, { method: "PATCH", body: datos, token });
}

export function eliminarBloque(token: string, id: number) {
  return apiRequest<void>(`/horario/bloques/${id}`, { method: "DELETE", token });
}

/** Reemplaza el horario completo. Si algún bloque es inválido, la API no cambia nada. */
export function reemplazarHorario(token: string, bloques: DatosBloque[]) {
  return apiRequest<{ bloques: BloqueClase[] }>("/horario", { method: "PUT", body: { bloques }, token });
}

/** Vista previa del archivo; no guarda nada. */
export function previsualizarIcs(token: string, contenido: string) {
  return apiRequest<{ bloques: BloqueImportado[]; omitidos: string[] }>("/horario/importar", {
    method: "POST",
    body: { contenido },
    token,
    timeoutMs: 20_000,
  });
}
