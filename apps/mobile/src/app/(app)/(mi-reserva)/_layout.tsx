import { Stack } from "expo-router";
import { useStackOptions } from "@/navigation/stack-options";

export default function MiReservaLayout() {
  const stackOptions = useStackOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="mi-reserva" options={{ title: "Mi reserva" }} />
      <Stack.Screen name="escanear" options={{ presentation: "modal", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
