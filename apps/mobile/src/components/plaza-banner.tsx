import { View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";
import { ThemedText } from "./themed-text";

/** Plaza que corresponde escanear: código grande y bloque, para encontrar el QR correcto. */
export function PlazaBanner({ codigo, bloque, instruccion }: { codigo: string; bloque: string; instruccion: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${instruccion}. Plaza ${codigo}, ${bloque}.`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.accent,
      }}
    >
      <View
        style={{
          minWidth: 64,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: colors.onAccent,
          alignItems: "center",
        }}
      >
        <ThemedText variant="largeTitle" style={{ color: colors.accent, fontVariant: ["tabular-nums"] }}>
          {codigo}
        </ThemedText>
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <ThemedText variant="headline" tone="onAccent">
          {instruccion}
        </ThemedText>
        <ThemedText variant="subhead" tone="onAccent" style={{ opacity: 0.85 }}>
          {bloque}
        </ThemedText>
      </View>
    </View>
  );
}
