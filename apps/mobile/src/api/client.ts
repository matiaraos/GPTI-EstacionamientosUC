import { fetch } from "expo/fetch";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

/** Error con el formato de la API: `{ error: { code, message, details? } }`. */
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

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

let onUnauthorized: (() => void) | undefined;

/** La sesión registra aquí qué hacer cuando la API rechaza el token (401). */
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!apiUrl) {
    throw new ApiError(0, "sin_configuracion", "Configura EXPO_PUBLIC_API_URL para conectarte a la API.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = (await fetch(`${apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
        ...(options.token && { Authorization: `Bearer ${options.token}` }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })) as unknown as Response;
  } catch {
    throw new ApiError(0, "sin_conexion", "No se pudo contactar al servidor. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    if (response.status === 401 && options.token) {
      onUnauthorized?.();
    }
    throw new ApiError(
      response.status,
      error?.code ?? "error_desconocido",
      error?.message ?? "Ocurrió un error inesperado. Inténtalo de nuevo.",
      error?.details,
    );
  }
  return payload as T;
}
