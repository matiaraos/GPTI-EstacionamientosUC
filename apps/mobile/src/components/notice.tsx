import { View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";
import { Icon, type IconName } from "./icon";
import { ThemedText, type TextTone } from "./themed-text";

type Tone = "error" | "info" | "success";

const config: Record<Tone, { icon: IconName; texto: TextTone }> = {
  error: { icon: "error", texto: "danger" },
  info: { icon: "info", texto: "accent" },
  success: { icon: "success", texto: "success" },
};

/** Mensaje a nivel de formulario o pantalla, con icono y fondo suave según su tono. */
export function Notice({ message, tone = "error" }: { message: string; tone?: Tone }) {
  const { colors } = useTheme();
  const fondo = tone === "error" ? colors.dangerSoft : tone === "success" ? colors.successSoft : colors.accentSoft;
  const color = tone === "error" ? colors.danger : tone === "success" ? colors.success : colors.accentText;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        gap: spacing.sm,
        alignItems: "flex-start",
        padding: spacing.md,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: fondo,
      }}
    >
      <Icon name={config[tone].icon} color={color} />
      <ThemedText variant="callout" tone={config[tone].texto} selectable style={{ flex: 1, fontWeight: "500" }}>
        {message}
      </ThemedText>
    </View>
  );
}
