import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, ApiError, setUnauthorizedHandler, type Cuenta } from "./api";

const STORAGE_KEY = "miestacionamientouc.panel.sesion";

type Sesion = { token: string; cuenta: Cuenta };

type SessionValue = {
  sesion: Sesion | null;
  iniciar: (correo: string, contrasena: string) => Promise<void>;
  cerrar: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function leerGuardada(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

/** La sesión del panel vive en `sessionStorage`: se pierde al cerrar la pestaña. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sesion, setSesion] = useState<Sesion | null>(leerGuardada);

  const olvidar = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSesion(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(olvidar);
    return () => setUnauthorizedHandler(undefined);
  }, [olvidar]);

  const iniciar = useCallback(async (correo: string, contrasena: string) => {
    const respuesta = await apiRequest<{ token: string; cuenta: Cuenta }>("/auth/sesion", {
      method: "POST",
      body: { correo, contrasena },
    });
    if (respuesta.cuenta.rol !== "admin") {
      // La API también rechaza sus operaciones; aquí se evita dejar abierta una sesión que no sirve en el panel.
      await apiRequest("/auth/sesion", { method: "DELETE", token: respuesta.token }).catch(() => undefined);
      throw new ApiError(403, "acceso_denegado", "Esta cuenta no tiene acceso al panel administrativo.");
    }
    const nueva = { token: respuesta.token, cuenta: respuesta.cuenta };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nueva));
    setSesion(nueva);
  }, []);

  const cerrar = useCallback(async () => {
    if (sesion) {
      await apiRequest("/auth/sesion", { method: "DELETE", token: sesion.token }).catch(() => undefined);
    }
    olvidar();
  }, [sesion, olvidar]);

  const value = useMemo(() => ({ sesion, iniciar, cerrar }), [sesion, iniciar, cerrar]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) {
    throw new Error("useSession debe usarse dentro de SessionProvider.");
  }
  return value;
}
