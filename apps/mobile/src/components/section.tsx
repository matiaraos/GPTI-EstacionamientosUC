import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { minTouch, radius, spacing, useTheme } from "@/theme";
import { Icon, type IconName } from "./icon";
import { ThemedText } from "./themed-text";

/**
 * Grupo de filas al estilo de las listas agrupadas nativas: título pequeño arriba, filas sobre una
 * superficie redondeada separadas por una línea fina, y una nota opcional abajo.
 */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const filas = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <ThemedText variant="overline" style={{ paddingHorizontal: spacing.md }} accessibilityRole="header">
          {title}
        </ThemedText>
      ) : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden" }}>
        {filas.map((fila, i) => (
          <Fragment key={fila.key ?? i}>
            {i > 0 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.md + 36 + spacing.md }} />
            ) : null}
            {fila}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <ThemedText variant="footnote" style={{ paddingHorizontal: spacing.md }}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

type RowProps = {
  icon: IconName;
  title: string;
  /** Valor a la derecha o, con `stacked`, bajo el título. */
  value?: string;
  /** Línea secundaria bajo el título. */
  detail?: string;
  /** Muestra el valor bajo el título en vez de a la derecha (textos largos). */
  stacked?: boolean;
  onPress?: () => void;
  tone?: "default" | "accent" | "danger";
  /** Contenido propio a la derecha (por ejemplo, un selector nativo). */
  accessory?: ReactNode;
  accessibilityHint?: string;
  error?: boolean;
  /** Oculta la flecha en filas que abren un selector en vez de navegar. */
  chevron?: boolean;
  /** Reemplaza la etiqueta accesible (por ejemplo, cuando el valor va en `accessory`). */
  accessibilityLabel?: string;
};

/** Fila de un `Section`: icono en un cuadrado de color, título, valor y flecha si es navegable. */
export function ListRow({ icon, title, value, detail, stacked, onPress, tone = "default", accessory, accessibilityHint, error, chevron = true, accessibilityLabel }: RowProps) {
  const etiqueta = accessibilityLabel ?? [title, value, detail].filter(Boolean).join(", ");
  const { colors } = useTheme();
  const colorIcono = tone === "danger" ? colors.danger : colors.accentText;
  const fondoIcono = tone === "danger" ? colors.dangerSoft : colors.accentSoft;
  const contenido = (pressed: boolean) => (
    <View
      style={{
        minHeight: minTouch + 12,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
        borderLeftWidth: error ? 3 : 0,
        borderLeftColor: colors.danger,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.sm + 2,
          borderCurve: "continuous",
          backgroundColor: fondoIcono,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} color={colorIcono} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <ThemedText variant="body" tone={tone === "danger" ? "danger" : tone === "accent" ? "accent" : "primary"} style={tone !== "default" ? { fontWeight: "600" } : undefined}>
          {title}
        </ThemedText>
        {stacked && value ? (
          <ThemedText variant="subhead" tone="primary" selectable>
            {value}
          </ThemedText>
        ) : null}
        {detail ? <ThemedText variant="footnote">{detail}</ThemedText> : null}
      </View>
      {!stacked && value ? (
        <ThemedText variant="body" tone="secondary" selectable style={{ fontVariant: ["tabular-nums"], maxWidth: "55%", textAlign: "right" }}>
          {value}
        </ThemedText>
      ) : null}
      {accessory}
      {onPress && chevron ? <Icon name="chevron" size={18} color={colors.tertiaryLabel} /> : null}
    </View>
  );

  if (!onPress) {
    return <View accessible accessibilityLabel={etiqueta}>{contenido(false)}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
    >
      {({ pressed }) => contenido(pressed)}
    </Pressable>
  );
}

/** Error asociado a un grupo de filas, mostrado bajo el grupo. */
export function FieldError({ message }: { message?: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={{ flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, alignItems: "flex-start" }}>
      <Icon name="error" size={16} color={colors.danger} />
      <ThemedText variant="footnote" tone="danger" selectable accessibilityLiveRegion="polite" style={{ flex: 1 }}>
        {message}
      </ThemedText>
    </View>
  );
}
