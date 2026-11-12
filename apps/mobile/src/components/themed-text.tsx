import { Text, type TextProps } from "react-native";
import { type, type TextVariant } from "@/theme";

export function ThemedText({ variant = "body", style, ...props }: TextProps & { variant?: TextVariant }) {
  return <Text style={[type[variant], style]} {...props} />;
}
