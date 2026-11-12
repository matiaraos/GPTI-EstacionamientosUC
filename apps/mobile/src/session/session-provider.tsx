import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "@/api/client";
import { cerrarSesion } from "@/api/cuentas";

const TOKEN_KEY = "miestacionamientouc.sesion";

type SessionValue = {
  /** `loading` mientras se lee el almacenamiento seguro; las rutas esperan a que termine. */
  status: "loading" | "signedOut" | "signedIn";
  token: string | null;
  signIn: (token: string) => Promise<void>;
  /** Revoca la sesión en la API (si hay conexión) y borra el token del dispositivo. */
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(setToken)
      .catch(() => setToken(null))
      .finally(() => setHydrated(true));
  }, []);

  const forget = useCallback(async () => {
    setToken(null);
    queryClient.clear();
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  }, [queryClient]);

  // Si la API rechaza el token (vencido o revocado en otro lugar), se vuelve al inicio de sesión.
  useEffect(() => {
    setUnauthorizedHandler(() => void forget());
    return () => setUnauthorizedHandler(undefined);
  }, [forget]);

  const signIn = useCallback(async (nuevo: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, nuevo);
    setToken(nuevo);
  }, []);

  const signOut = useCallback(async () => {
    if (token) {
      await cerrarSesion(token).catch(() => undefined);
    }
    await forget();
  }, [token, forget]);

  const value = useMemo<SessionValue>(
    () => ({ status: !hydrated ? "loading" : token ? "signedIn" : "signedOut", token, signIn, signOut }),
    [hydrated, token, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) {
    throw new Error("useSession debe usarse dentro de SessionProvider.");
  }
  return value;
}
