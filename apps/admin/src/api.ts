export const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; token?: string | null; timeoutMs?: number };

let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(path: string, options: Options = {}): Promise<T> {
  if (!apiUrl) {
    throw new ApiError(0, "sin_configuracion", "Configura VITE_API_URL para conectarte a la API.");
  }
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
        ...(options.token && { Authorization: `Bearer ${options.token}` }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
  } catch {
    throw new ApiError(0, "sin_conexion", "No se pudo contactar a la API.");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && options.token) {
      onUnauthorized?.();
    }
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "error_desconocido",
      error?.message ?? "Ocurrió un error inesperado.",
      error?.details,
    );
  }
  return payload as T;
}

export type Cuenta = {
  id: number;
  correo: string;
  rol: "usuario" | "admin";
  activa?: boolean;
  creadaEn?: string;
  vehiculos: { id: number; patente: string }[];
};
