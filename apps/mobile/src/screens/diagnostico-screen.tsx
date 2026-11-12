import { useMutation } from "@tanstack/react-query";
import { ScrollView } from "react-native";
import { apiRequest, apiUrl } from "@/api/client";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/theme";

/** Comprueba que la app llega a la API y que la API llega a PostgreSQL (`GET /ready`). */
export default function DiagnosticoScreen() {
  const check = useMutation({ mutationFn: () => apiRequest<{ status: string }>("/ready", { timeoutMs: 5000 }) });

  let message = "Pendiente de verificar.";
  if (check.isPending) {
    message = "Verificando conexión…";
  } else if (check.isSuccess) {
    message = "API y base de datos disponibles.";
  } else if (check.error) {
    message = check.error.message.startsWith("No se pudo contactar")
      ? "No se pudo contactar a la API."
      : "El servicio no está disponible.";
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <ThemedText variant="subhead" selectable>
        Servidor: {apiUrl ?? "sin configurar (EXPO_PUBLIC_API_URL)"}
      </ThemedText>
      <Button title="Verificar conexión" onPress={() => check.mutate()} loading={check.isPending} />
      <Notice message={message} tone={check.error ? "error" : "info"} />
    </ScrollView>
  );
}
