import { ActivityIndicator, Pressable, Text, type ColorValue, type PressableProps } from "react-native";
import { colors, minTouch, radius, spacing, type } from "@/theme";

type Variant = "primary" | "secondary" | "destructive";

type Props = Omit<PressableProps, "children"> & {
  title: string;
  variant?: Variant;
  /** Muestra un indicador y bloquea pulsaciones repetidas mientras dura la operación. */
  loading?: boolean;
};

const variants: Record<Variant, { background: ColorValue; text: ColorValue }> = {
  primary: { background: colors.accent, text: colors.onAccent },
  secondary: { background: colors.field, text: colors.accent },
  destructive: { background: colors.field, text: colors.danger },
};

export function Button({ title, variant = "primary", loading = false, disabled, style, ...props }: Props) {
  const palette = variants[variant];
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={(state) => [
        {
          minHeight: minTouch + 6,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: palette.background,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: spacing.sm,
          opacity: inactive ? 0.55 : state.pressed ? 0.8 : 1,
        },
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading && <ActivityIndicator color={palette.text} />}
      <Text style={[type.headline, { color: palette.text }]}>{title}</Text>
    </Pressable>
  );
}
