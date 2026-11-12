import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView } from "react-native";
import { colors, spacing } from "@/theme";

/**
 * Contenedor de formularios: desplaza el contenido sobre el teclado para que los campos y la
 * acción principal sigan accesibles, y deja que los toques lleguen a los controles.
 */
export function FormScreen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
