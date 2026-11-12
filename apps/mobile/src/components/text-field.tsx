import { forwardRef, useId } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { colors, minTouch, radius, spacing, type } from "@/theme";
import { ThemedText } from "./themed-text";

type Props = TextInputProps & {
  label: string;
  /** Mensaje bajo el campo. Si existe, el campo se marca como inválido. */
  error?: string;
  hint?: string;
};

/** Campo con etiqueta visible y error junto al campo. */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, hint, style, ...props }, ref) {
  const id = useId();
  const message = error ?? hint;
  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="subhead" nativeID={`${id}-label`} style={{ color: colors.label, fontWeight: "500" }}>
        {label}
      </ThemedText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={message}
        placeholderTextColor={colors.placeholder as string}
        style={[
          type.body,
          {
            minHeight: minTouch + 4,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.field,
            borderWidth: error ? 1.5 : 0,
            borderColor: colors.danger,
          },
          style,
        ]}
        {...props}
      />
      {message ? (
        <ThemedText
          variant="footnote"
          selectable
          accessibilityLiveRegion={error ? "polite" : "none"}
          style={error ? { color: colors.danger } : undefined}
        >
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
});
