import { Stack } from "expo-router";
import { useStackOptions } from "@/navigation/stack-options";

export default function ReservarLayout() {
  const stackOptions = useStackOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: "Reservar" }} />
      <Stack.Screen
        name="elegir-destino"
        options={{ title: "Elegir destino", presentation: "modal", headerLargeTitleEnabled: false }}
      />
    </Stack>
  );
}
