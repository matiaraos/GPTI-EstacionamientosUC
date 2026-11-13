import { Pressable, View } from "react-native";
import { minTouch, radius, spacing, useTheme } from "@/theme";
import { ThemedText } from "./themed-text";

const CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
const LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Selector de un día de la semana (1 = lunes … 7 = domingo) como fila de botones. */
export function DayPicker({ value, onChange }: { value: number; onChange: (dia: number) => void }) {
  return <Dias activos={[value]} onToggle={onChange} rol="radio" />;
}

/** Selector de varios días (por ejemplo, los de una reserva semanal). */
export function DaysPicker({ value, onChange }: { value: number[]; onChange: (dias: number[]) => void }) {
  return (
    <Dias
      activos={value}
      rol="checkbox"
      onToggle={(dia) => onChange(value.includes(dia) ? value.filter((d) => d !== dia) : [...value, dia].sort())}
    />
  );
}

function Dias({ activos, onToggle, rol }: { activos: number[]; onToggle: (dia: number) => void; rol: "radio" | "checkbox" }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole={rol === "radio" ? "radiogroup" : undefined} style={{ flexDirection: "row", gap: spacing.xs }}>
      {CORTOS.map((corto, i) => {
        const dia = i + 1;
        const activo = activos.includes(dia);
        return (
          <Pressable
            key={corto}
            accessibilityRole={rol}
            accessibilityLabel={LARGOS[i]}
            accessibilityState={rol === "radio" ? { selected: activo } : { checked: activo }}
            onPress={() => onToggle(dia)}
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
