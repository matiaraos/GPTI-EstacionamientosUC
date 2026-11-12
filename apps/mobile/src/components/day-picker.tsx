import { Pressable, View } from "react-native";
import { minTouch, radius, spacing, useTheme } from "@/theme";
import { ThemedText } from "./themed-text";

const CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
const LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Selector de un día de la semana (1 = lunes … 7 = domingo) como fila de botones. */
export function DayPicker({ value, onChange }: { value: number; onChange: (dia: number) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: spacing.xs }}>
      {CORTOS.map((corto, i) => {
        const dia = i + 1;
        const activo = dia === value;
        return (
          <Pressable
            key={corto}
            accessibilityRole="radio"
            accessibilityLabel={LARGOS[i]}
            accessibilityState={{ selected: activo }}
            onPress={() => onChange(dia)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: minTouch,
              borderRadius: radius.md,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: activo ? colors.accent : pressed ? colors.surfaceMuted : colors.surface,
            })}
          >
            <ThemedText variant="headline" tone={activo ? "onAccent" : "primary"}>
              {corto}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
