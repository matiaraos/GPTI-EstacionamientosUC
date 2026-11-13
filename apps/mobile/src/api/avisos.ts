import { apiRequest } from "./client";

export type Aviso = {
  id: number;
  tipo: "confirmacion" | "cancelacion" | "cambio" | "sin_cupo" | "espera_asignada" | "recordatorio_clase" | "recordatorio_salida";
  titulo: string;
  cuerpo: string;
  estado: "pendiente" | "enviando" | "enviado" | "fallido" | "cancelado";
  canal: "push" | "correo" | null;
  programadoEn: string;
  enviadoEn: string | null;
  reservaId: number | null;
};

export type AvisoProgramado = Pick<Aviso, "id" | "tipo" | "titulo" | "programadoEn" | "reservaId">;

export function obtenerAvisos(token: string) {
  return apiRequest<{ avisos: Aviso[]; programados: AvisoProgramado[] }>("/avisos", { token });
}

export function registrarDispositivo(token: string, pushToken: string, plataforma: "android" | "ios") {
  return apiRequest<void>("/avisos/canales", { method: "POST", body: { token: pushToken, plataforma }, token });
}

export function olvidarDispositivo(token: string, pushToken: string) {
  return apiRequest<void>("/avisos/canales", { method: "DELETE", body: { token: pushToken }, token });
}
