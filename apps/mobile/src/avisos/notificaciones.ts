import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

// Con la app abierta, la notificación se muestra igual como banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Último token obtenido en este dispositivo, para dejar de usarlo al cerrar sesión. */
let tokenActual: string | null = null;
export const tokenPushActual = () => tokenActual;

export type EstadoNotificaciones =
  | { estado: "activas"; token: string }
  | { estado: "sin_permiso" }
  | { estado: "no_disponibles"; motivo: string };

/**
 * Pide permiso y obtiene el token de Expo Push. Requiere una compilación con `projectId` de EAS: en
 * Expo Go (Android) o sin proyecto EAS no hay notificaciones remotas y los avisos llegan por correo
 * y a la bandeja de la app.
 */
export async function obtenerTokenPush(): Promise<EstadoNotificaciones> {
  try {
    if (process.env.EXPO_OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Reservas",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return { estado: "sin_permiso" };
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return { estado: "no_disponibles", motivo: "Esta compilación no tiene un proyecto EAS para notificaciones." };
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    tokenActual = data;
    return { estado: "activas", token: data };
  } catch (error) {
    return { estado: "no_disponibles", motivo: error instanceof Error ? error.message : "No se pudo activar." };
  }
}
