import { Stack } from "expo-router";
import { stackScreenOptions } from "@/navigation/stack-options";

export default function AppLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Mi cuenta" }} />
    </Stack>
  );
}
