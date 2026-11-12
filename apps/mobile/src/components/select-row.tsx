import { Pressable, View } from "react-native";
import { colors, minTouch, radius, spacing } from "@/theme";
import { ThemedText } from "./themed-text";

type Props = {
  label: string;
  /** Valor elegido; si falta se muestra `placeholder`. */
  value?: string;
  detail?: string;
  placeholder: string;
  onPress: () => void;
  error?: string;
};

/** Fila que abre otra pantalla para elegir un valor, con su error junto al campo. */
export function SelectRow({ label, value, detail, placeholder, onPress, error }: Props) {
  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="subhead" style={{ color: colors.label, fontWeight: "500" }}>
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityHint="Abre la búsqueda"
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: minTouch + 12,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: colors.field,
          borderWidth: error ? 1.5 : 0,
          borderColor: colors.danger,
          justifyContent: "center",
          gap: 2,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <ThemedText variant="body" style={value ? undefined : { color: colors.accent }}>
          {value ?? placeholder}
        </ThemedText>
        {value && detail ? <ThemedText variant="footnote">{detail}</ThemedText> : null}
      </Pressable>
      {error ? (
        <ThemedText variant="footnote" selectable accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
