import { Stack } from "expo-router";
import { stackScreenOptions } from "@/navigation/stack-options";

export default function ReservarLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Reservar" }} />
      <Stack.Screen
        name="elegir-destino"
        options={{ title: "Elegir destino", presentation: "modal", headerLargeTitleEnabled: false }}
      />
    </Stack>
  );
}
