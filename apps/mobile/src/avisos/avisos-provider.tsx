import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { registrarDispositivo } from "@/api/avisos";
import { useSession } from "@/session/session-provider";
import { obtenerTokenPush, type EstadoNotificaciones } from "./notificaciones";

const AvisosContext = createContext<EstadoNotificaciones | null>(null);

/**
 * Con sesión iniciada, registra el dispositivo para recibir avisos. Al tocar una notificación abre
 * Mi reserva y actualiza los datos, por si el estado cambió.
 */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoNotificaciones | null>(null);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    void obtenerTokenPush().then(async (resultado) => {
      if (!vigente) return;
      setEstado(resultado);
      if (resultado.estado === "activas") {
        await registrarDispositivo(token, resultado.token, process.env.EXPO_OS === "ios" ? "ios" : "android").catch(() => undefined);
      }
    });
    return () => {
      vigente = false;
    };
  }, [token]);

  useEffect(() => {
    const recibida = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ["avisos"] });
      void queryClient.invalidateQueries({ queryKey: ["reservas"] });
    });
    const tocada = Notifications.addNotificationResponseReceivedListener(() => {
      void queryClient.invalidateQueries();
      router.navigate("/mi-reserva");
    });
    return () => {
      recibida.remove();
      tocada.remove();
    };
  }, [queryClient, router]);

  return <AvisosContext value={estado}>{children}</AvisosContext>;
}

/** Estado de las notificaciones del dispositivo (`null` mientras se consulta). */
export function useNotificaciones() {
  return use(AvisosContext);
}
