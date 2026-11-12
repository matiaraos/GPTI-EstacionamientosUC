import { Text, type TextProps } from "react-native";
import { type, useTheme, type Palette, type TextVariant } from "@/theme";

export type TextTone = "primary" | "secondary" | "tertiary" | "accent" | "danger" | "success" | "onAccent";

const tonos: Record<TextTone, keyof Palette> = {
  primary: "label",
  secondary: "secondaryLabel",
  tertiary: "tertiaryLabel",
  accent: "accentText",
  danger: "danger",
  success: "success",
  onAccent: "onAccent",
};

/** Texto del sistema de diseño: tamaño por `variant` y color por `tone` (por defecto según la variante). */
export function ThemedText({
  variant = "body",
  tone,
  style,
  ...props
}: TextProps & { variant?: TextVariant; tone?: TextTone }) {
  const { colors } = useTheme();
  const porDefecto: TextTone = variant === "subhead" || variant === "footnote" || variant === "overline" ? "secondary" : "primary";
  return <Text style={[type[variant], { color: colors[tonos[tone ?? porDefecto]] }, style]} {...props} />;
}
