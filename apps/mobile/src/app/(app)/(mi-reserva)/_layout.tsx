import { Stack } from "expo-router";
import { stackScreenOptions } from "@/navigation/stack-options";

export default function MiReservaLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="mi-reserva" options={{ title: "Mi reserva" }} />
      <Stack.Screen name="escanear" options={{ presentation: "modal", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
