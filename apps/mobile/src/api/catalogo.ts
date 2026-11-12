import { apiRequest } from "./client";

export type Destino = {
  id: number;
  idOrigen: string;
  nombre: string;
  tipo: "sala" | "edificio";
  pisos: number[];
};

export function buscarDestinos(token: string, q: string) {
  return apiRequest<{ destinos: Destino[] }>(`/destinos?q=${encodeURIComponent(q)}&limite=30`, { token });
}

/** "Sala · ED113-SJ · piso 1" o "Edificio". El ID de origen distingue salas con el mismo nombre. */
export function detalleDestino(destino: Destino): string {
  if (destino.tipo === "edificio") {
    return "Edificio";
  }
  const pisos = destino.pisos.length > 0 ? ` · piso ${destino.pisos.join(", ")}` : "";
  return `Sala · ${destino.idOrigen}${pisos}`;
}
