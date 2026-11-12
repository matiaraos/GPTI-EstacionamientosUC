import { Stack } from "expo-router";
import { useStackOptions } from "@/navigation/stack-options";

export default function CuentaLayout() {
  const stackOptions = useStackOptions();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="cuenta" options={{ title: "Mi cuenta" }} />
    </Stack>
  );
}
