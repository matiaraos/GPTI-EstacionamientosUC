import { Stack } from "expo-router";
import { useStackOptions } from "@/navigation/stack-options";
import { SerieProvider } from "@/reserva/serie-provider";

export default function ReservarLayout() {
  const stackOptions = useStackOptions();
  return (
    <SerieProvider>
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="index" options={{ title: "Reservar" }} />
        <Stack.Screen
          name="elegir-destino"
          options={{ title: "Elegir destino", presentation: "modal", headerLargeTitleEnabled: false }}
        />
        <Stack.Screen name="series" options={{ title: "Reservas semanales" }} />
        <Stack.Screen name="nueva-serie" options={{ title: "Nueva reserva semanal", headerLargeTitleEnabled: false }} />
        <Stack.Screen name="serie-destino" options={{ title: "Elegir destino", presentation: "modal", headerLargeTitleEnabled: false }} />
      </Stack>
    </SerieProvider>
  );
}
