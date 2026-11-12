import { useMutation } from "@tanstack/react-query";
import { ScrollView } from "react-native";
import { apiRequest, apiUrl } from "@/api/client";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { spacing, useTheme } from "@/theme";

/** Comprueba que la app llega a la API y que la API llega a PostgreSQL (`GET /ready`). */
export default function DiagnosticoScreen() {
  const { colors } = useTheme();
  const check = useMutation({ mutationFn: () => apiRequest<{ status: string }>("/ready", { timeoutMs: 5000 }) });

  let aviso: { tone: "info" | "success" | "error"; message: string } = { tone: "info", message: "Pendiente de verificar." };
  if (check.isPending) {
    aviso = { tone: "info", message: "Verificando conexión…" };
  } else if (check.isSuccess) {
    aviso = { tone: "success", message: "API y base de datos disponibles." };
  } else if (check.error) {
    aviso = {
      tone: "error",
      message: check.error.message.startsWith("No se pudo contactar") ? "No se pudo contactar a la API." : "El servicio no está disponible.",
    };
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      <Section title="Servidor">
        <ListRow icon="wifi" title="Dirección de la API" value={apiUrl ?? "Sin configurar (EXPO_PUBLIC_API_URL)"} stacked />
      </Section>
      <Notice tone={aviso.tone} message={aviso.message} />
      <Button title="Verificar conexión" icon="wifi" onPress={() => check.mutate()} loading={check.isPending} />
    </ScrollView>
  );
}
