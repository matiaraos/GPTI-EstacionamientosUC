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

type Options = { method?: string; body?: unknown; token?: string | null; timeoutMs?: number; headers?: Record<string, string> };

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
        ...options.headers,
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
  puntaje?: number;
  vehiculos: { id: number; patente: string }[];
};

export type Horario = { diaSemana: number; abre: string; cierra: string };

export type Zona = {
  id: number;
  idOrigen: string | null;
  nombre: string;
  activa: boolean;
  acceso: string | null;
  horarios: Horario[];
  plazas: { total: number; activas: number; preferentes: number };
};

export type Bloqueo = {
  id: number;
  inicio: string;
  fin: string;
  inicioLocal: string;
  finLocal: string;
  motivo: string;
  creadoEn: string;
  levantadoEn: string | null;
  plaza: { id: number; codigo: string; zona: { id: number; nombre: string } };
  creadoPor: { correo: string };
};

export type Plaza = {
  id: number;
  codigo: string;
  tipo: "regular" | "preferente";
  activa: boolean;
  zona: { id: number; nombre: string; idOrigen: string | null };
  qr: string | null;
  bloqueada: boolean;
  bloqueos: { id: number; inicio: string; fin: string; motivo: string }[];
};

/** Reserva vigente afectada por un cambio de inventario. */
export type ReservaAfectada = {
  id: number;
  estado: string;
  fecha: string;
  llegada: string;
  salida: string;
  plaza: { codigo: string };
  zona: { nombre: string };
  cuenta: { id: number; correo: string };
};
