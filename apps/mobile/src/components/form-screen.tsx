import type { ReactNode } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { colors, spacing } from "@/theme";

/**
 * Contenedor de formularios: con el teclado abierto, desplaza el contenido para que el campo
 * activo y la acción principal sigan visibles. Usa el tamaño real del teclado, también en Android
 * con pantalla completa (edge-to-edge), donde `KeyboardAvoidingView` de React Native no lo reserva.
 */
export function FormScreen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={spacing.xl}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg }}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
