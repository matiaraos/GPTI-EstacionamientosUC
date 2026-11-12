import { apiRequest } from "./client";

export type Cuenta = {
  id: number;
  correo: string;
  rol: "usuario" | "admin";
  vehiculos: { id: number; patente: string }[];
};

export type DatosRegistro = { correo: string; contrasena: string; patente: string };

export function registrar(datos: DatosRegistro) {
  return apiRequest<{ cuenta: Cuenta }>("/auth/registro", { method: "POST", body: datos });
}

export function iniciarSesion(correo: string, contrasena: string) {
  return apiRequest<{ token: string; venceEn: string; cuenta: Cuenta }>("/auth/sesion", {
    method: "POST",
    body: { correo, contrasena },
  });
}

export function cerrarSesion(token: string) {
  return apiRequest<void>("/auth/sesion", { method: "DELETE", token });
}

export function obtenerCuenta(token: string) {
  return apiRequest<{ cuenta: Cuenta }>("/cuenta", { token });
}

/** La respuesta es la misma exista o no la cuenta. */
export function solicitarRecuperacion(correo: string) {
  return apiRequest<{ mensaje: string }>("/auth/recuperacion", { method: "POST", body: { correo } });
}

export function confirmarRecuperacion(token: string, contrasena: string) {
  return apiRequest<{ mensaje: string }>("/auth/recuperacion/confirmar", { method: "POST", body: { token, contrasena } });
}

/** Acepta el token o el enlace completo pegado desde el correo. */
export function tokenDeEnlace(texto: string): string {
  const limpio = texto.trim();
  const coincidencia = /[?&]token=([^&\s]+)/.exec(limpio);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : limpio;
}
