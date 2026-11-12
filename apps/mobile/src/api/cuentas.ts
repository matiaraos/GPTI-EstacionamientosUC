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
