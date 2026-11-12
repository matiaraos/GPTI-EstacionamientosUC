import type { ReactNode } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "@/theme";

/**
 * Contenedor de pantallas con formularios: con el teclado abierto, desplaza el contenido para que el
 * campo activo y la acción principal sigan visibles. Usa el tamaño real del teclado, también en
 * Android con pantalla completa (edge-to-edge), donde `KeyboardAvoidingView` no lo reserva.
 */
export function FormScreen({ children, sinEncabezado = false }: { children: ReactNode; sinEncabezado?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      bottomOffset={spacing.xl}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.md,
        // Sin encabezado de navegación, el contenido respeta la zona segura superior.
        paddingTop: sinEncabezado ? insets.top + spacing.xl : spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      }}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
