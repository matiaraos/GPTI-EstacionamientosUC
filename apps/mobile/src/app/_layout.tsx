import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { SessionProvider, useSession } from "@/session/session-provider";
import { useStackOptions } from "@/navigation/stack-options";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Los errores 4xx son definitivos (datos inválidos, sin permiso); solo se reintentan fallas de red o 5xx.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

function RootStack() {
  const { status } = useSession();
  const stackOptions = useStackOptions();
  // Hasta leer el token no se decide la ruta, para no mostrar una pantalla equivocada al abrir la app.
  if (status === "loading") {
    return null;
  }
  const signedIn = status === "signedIn";
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="iniciar-sesion" options={{ title: "Iniciar sesión", headerShown: false }} />
        <Stack.Screen name="registro" options={{ title: "Crear cuenta" }} />
      </Stack.Protected>
      <Stack.Screen name="diagnostico" options={{ title: "Diagnóstico", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style="auto" />
            <RootStack />
          </SessionProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
