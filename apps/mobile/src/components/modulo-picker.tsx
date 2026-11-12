import { Pressable, View } from "react-native";
import { MODULOS_UC } from "@/api/horario";
import { minTouch, radius, spacing, useTheme } from "@/theme";
import { ThemedText } from "./themed-text";

type Props = { inicio: string; fin: string; onChange: (rango: { inicio: string; fin: string }) => void };

/**
 * Módulos del horario UC (1 a 9). Tocar un módulo fija el bloque en ese módulo; tocar el siguiente
 * extiende el bloque (por ejemplo, módulos 5 y 6 de un laboratorio).
 */
export function ModuloPicker({ inicio, fin, onChange }: Props) {
  const { colors } = useTheme();
  const desde = MODULOS_UC.find((m) => m.inicio === inicio)?.modulo;
  const hasta = MODULOS_UC.find((m) => m.fin === fin)?.modulo;
  const elegir = (modulo: number) => {
    const m = MODULOS_UC[modulo - 1];
    if (desde && hasta && modulo === hasta + 1) onChange({ inicio, fin: m.fin });
    else onChange({ inicio: m.inicio, fin: m.fin });
  };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }} accessibilityLabel="Módulos UC">
      {MODULOS_UC.map((m) => {
        const activo = desde !== undefined && hasta !== undefined && m.modulo >= desde && m.modulo <= hasta;
        return (
          <Pressable
            key={m.modulo}
            accessibilityRole="button"
            accessibilityLabel={`Módulo ${m.modulo}, ${m.inicio} a ${m.fin}`}
            accessibilityState={{ selected: activo }}
            onPress={() => elegir(m.modulo)}
            style={({ pressed }) => ({
              minWidth: 64,
              minHeight: minTouch,
              flexGrow: 1,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.md,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: activo ? colors.accent : pressed ? colors.surfaceMuted : colors.surface,
            })}
          >
            <ThemedText variant="headline" tone={activo ? "onAccent" : "primary"}>
              {m.modulo}
            </ThemedText>
            <ThemedText variant="footnote" tone={activo ? "onAccent" : "secondary"} style={{ fontVariant: ["tabular-nums"] }}>
              {m.inicio}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
