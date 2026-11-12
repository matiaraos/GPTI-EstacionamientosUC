import type { ReactNode } from "react";
import { View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";
import { Icon, type IconName } from "./icon";
import { ThemedText } from "./themed-text";

/** Estado vacío: explica por qué no hay contenido y ofrece la siguiente acción. */
export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.full,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={34} color={colors.accentText} />
      </View>
      <View style={{ gap: spacing.xs, alignItems: "center" }}>
        <ThemedText variant="title" style={{ textAlign: "center" }}>
          {title}
        </ThemedText>
        <ThemedText variant="callout" tone="secondary" style={{ textAlign: "center" }}>
          {message}
        </ThemedText>
      </View>
      {action ? <View style={{ alignSelf: "stretch", paddingTop: spacing.sm }}>{action}</View> : null}
    </View>
  );
}
