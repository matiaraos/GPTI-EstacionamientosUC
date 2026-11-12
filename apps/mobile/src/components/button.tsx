import { ActivityIndicator, Pressable, Text, View, type PressableProps } from "react-native";
import { minTouch, radius, spacing, type, useTheme, type Palette } from "@/theme";
import { Icon, type IconName } from "./icon";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

type Props = Omit<PressableProps, "children"> & {
  title: string;
  variant?: Variant;
  icon?: IconName;
  /** Muestra un indicador y bloquea pulsaciones repetidas mientras dura la operación. */
  loading?: boolean;
};

function estilos(colors: Palette, variant: Variant, pressed: boolean) {
  switch (variant) {
    case "primary":
      return { fondo: pressed ? colors.accentPressed : colors.accent, texto: colors.onAccent };
    case "secondary":
      return { fondo: colors.accentSoft, texto: colors.accentText };
    case "destructive":
      return { fondo: colors.dangerSoft, texto: colors.danger };
    case "ghost":
      return { fondo: "transparent", texto: colors.accentText };
  }
}

export function Button({ title, variant = "primary", icon, loading = false, disabled, style, ...props }: Props) {
  const { colors } = useTheme();
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={(state) => {
        const { fondo } = estilos(colors, variant, state.pressed);
        return [
          {
            minHeight: minTouch + 8,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: fondo,
            alignItems: "center",
            justifyContent: "center",
            opacity: inactive ? 0.5 : state.pressed && variant !== "primary" ? 0.7 : 1,
          },
          typeof style === "function" ? style(state) : style,
        ];
      }}
      {...props}
    >
      {({ pressed }) => {
        const { texto } = estilos(colors, variant, pressed);
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {loading ? <ActivityIndicator color={texto} /> : icon ? <Icon name={icon} color={texto} /> : null}
            <Text style={[type.headline, { color: texto }]}>{title}</Text>
          </View>
        );
      }}
    </Pressable>
  );
}
