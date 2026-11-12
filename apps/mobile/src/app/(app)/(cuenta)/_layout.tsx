import { Stack } from "expo-router";
import { useStackOptions } from "@/navigation/stack-options";

export default function CuentaLayout() {
  const stackOptions = useStackOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="cuenta" options={{ title: "Mi cuenta" }} />
      <Stack.Screen name="horario" options={{ title: "Mi horario" }} />
      <Stack.Screen name="bloque" options={{ title: "Bloque de clase", headerLargeTitleEnabled: false }} />
      <Stack.Screen name="importar-horario" options={{ title: "Importar horario", headerLargeTitleEnabled: false }} />
      <Stack.Screen name="horario-destino" options={{ title: "Elegir destino", presentation: "modal", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
