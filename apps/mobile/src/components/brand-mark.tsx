import { View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";
import { Icon } from "./icon";
import { ThemedText } from "./themed-text";

/** Marca de la app: señal de estacionamiento sobre el azul institucional, con nombre y campus. */
export function BrandMark() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }} accessible accessibilityRole="header" accessibilityLabel="MiEstacionamientoUC, Campus San Joaquín">
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="parking" size={38} color={colors.onAccent} />
      </View>
      <View style={{ gap: spacing.xs }}>
        <ThemedText variant="largeTitle">MiEstacionamientoUC</ThemedText>
        <ThemedText variant="callout" tone="secondary">
          Campus San Joaquín
        </ThemedText>
      </View>
    </View>
  );
}
