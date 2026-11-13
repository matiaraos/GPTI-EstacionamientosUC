import { useMutation } from "@tanstack/react-query";
import { Pressable, View } from "react-native";
import { responderEncuesta } from "@/api/reservas";
import { useSession } from "@/session/session-provider";
import { minTouch, radius, spacing, useTheme } from "@/theme";
import { Icon } from "./icon";
import { ThemedText } from "./themed-text";

const ETIQUETAS = ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"];

/** Pregunta de satisfacción tras la salida (indicador del piloto). Es opcional. */
export function Encuesta({ reservaId }: { reservaId: number }) {
  const { colors } = useTheme();
  const { token } = useSession();
  const enviar = useMutation({ mutationFn: (puntaje: number) => responderEncuesta(token!, reservaId, puntaje) });

  if (enviar.isSuccess) {
    return (
      <ThemedText variant="callout" tone="success" style={{ textAlign: "center" }}>
        {enviar.data.mensaje}
      </ThemedText>
    );
  }
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: colors.surface }}>
      <ThemedText variant="headline" style={{ textAlign: "center" }}>
        ¿Cómo fue tu experiencia hoy?
      </ThemedText>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xs }} accessibilityRole="radiogroup">
        {ETIQUETAS.map((etiqueta, i) => (
          <Pressable
            key={etiqueta}
            accessibilityRole="radio"
            accessibilityLabel={`${i + 1} de 5, ${etiqueta}`}
            disabled={enviar.isPending}
            onPress={() => enviar.mutate(i + 1)}
            style={({ pressed }) => ({ minWidth: minTouch, minHeight: minTouch, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="star" size={30} color={enviar.variables && i < enviar.variables ? colors.warning : colors.tertiaryLabel} />
          </Pressable>
        ))}
      </View>
      <ThemedText variant="footnote" style={{ textAlign: "center" }}>
        {enviar.error ? "No se pudo enviar. Toca de nuevo." : "Toca de 1 a 5 estrellas. Nos ayuda a evaluar el piloto."}
      </ThemedText>
    </View>
  );
}
