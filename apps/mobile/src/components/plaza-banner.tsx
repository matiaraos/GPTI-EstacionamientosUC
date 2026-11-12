import { View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { ThemedText } from "./themed-text";

/** Plaza que corresponde escanear: código grande y bloque, para encontrar el QR correcto. */
export function PlazaBanner({ codigo, bloque, instruccion }: { codigo: string; bloque: string; instruccion: string }) {
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
        backgroundColor: colors.surface,
        borderLeftWidth: 4,
        borderLeftColor: colors.accent,
      }}
    >
      <ThemedText variant="largeTitle" selectable style={{ color: colors.accent }}>
        {codigo}
      </ThemedText>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="headline">{instruccion}</ThemedText>
        <ThemedText variant="subhead">{bloque}</ThemedText>
      </View>
    </View>
  );
}
