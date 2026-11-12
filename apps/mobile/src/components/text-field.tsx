import { forwardRef, useId, useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { minTouch, radius, spacing, type, useTheme } from "@/theme";
import { Icon, type IconName } from "./icon";
import { ThemedText } from "./themed-text";

type Props = TextInputProps & {
  label: string;
  /** Mensaje bajo el campo. Si existe, el campo se marca como inválido. */
  error?: string;
  hint?: string;
  icon?: IconName;
  /** Para contraseñas: agrega un botón para mostrar u ocultar el texto. */
  revelable?: boolean;
};

/** Campo con etiqueta visible, estado de foco, error junto al campo e icono opcional. */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, icon, revelable, secureTextEntry, style, onFocus, onBlur, ...props },
  ref,
) {
  const { colors } = useTheme();
  const id = useId();
  const [foco, setFoco] = useState(false);
  const [visible, setVisible] = useState(false);
  const message = error ?? hint;
  const borde = error ? colors.danger : foco ? colors.accent : "transparent";

  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="subhead" tone="primary" nativeID={`${id}-label`} style={{ fontWeight: "600" }}>
        {label}
      </ThemedText>
      <View
        style={{
          minHeight: minTouch + 8,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1.5,
          borderColor: borde,
        }}
      >
        {icon ? <Icon name={icon} color={foco ? colors.accentText : colors.tertiaryLabel} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${id}-label`}
          accessibilityHint={message}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          secureTextEntry={secureTextEntry && !visible}
          onFocus={(event) => {
            setFoco(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFoco(false);
            onBlur?.(event);
          }}
          style={[type.body, { flex: 1, color: colors.label, paddingVertical: spacing.sm }, style]}
          {...props}
        />
        {revelable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            hitSlop={12}
            onPress={() => setVisible((actual) => !actual)}
          >
            <Icon name={visible ? "eyeOff" : "eye"} color={colors.tertiaryLabel} />
          </Pressable>
        ) : null}
      </View>
      {message ? (
        <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "flex-start" }}>
          {error ? <Icon name="error" size={16} color={colors.danger} /> : null}
          <ThemedText
            variant="footnote"
            tone={error ? "danger" : "secondary"}
            selectable
            accessibilityLiveRegion={error ? "polite" : "none"}
            style={{ flex: 1 }}
          >
            {message}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
});
