import { Stack } from "expo-router";
import { stackScreenOptions } from "@/navigation/stack-options";

export default function CuentaLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="cuenta" options={{ title: "Mi cuenta" }} />
    </Stack>
  );
}
