import { View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { ThemedText } from "./themed-text";

/** Mensaje de error u otra información a nivel de formulario o pantalla. */
export function Notice({ message, tone = "error" }: { message: string; tone?: "error" | "info" }) {
  const isError = tone === "error";
  return (
    <View
      accessibilityRole={isError ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={{
        padding: spacing.md,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: isError ? colors.dangerSurface : colors.surface,
        borderLeftWidth: 4,
        borderLeftColor: isError ? colors.danger : colors.accent,
      }}
    >
      <ThemedText variant="callout" selectable style={isError ? { color: colors.danger } : undefined}>
        {message}
      </ThemedText>
    </View>
  );
}
