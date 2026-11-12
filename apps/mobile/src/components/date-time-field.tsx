import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Pressable, View } from "react-native";
import { dateDesdeTexto, fechaDeDate, fechaLegible, horaDeDate } from "@/lib/tiempo";
import { colors, minTouch, radius, spacing, type } from "@/theme";
import { ThemedText } from "./themed-text";

type Props = {
  label: string;
  mode: "date" | "time";
  /** "AAAA-MM-DD" para fechas y "HH:MM" para horas. */
  value: string;
  onChange: (value: string) => void;
  /** Fecha mínima seleccionable (solo para `mode="date"`). */
  minimumDate?: string;
  error?: string;
};

/**
 * Selector nativo de fecha u hora. En iOS se muestra el control compacto en línea; en Android,
 * una fila que abre el diálogo del sistema. La hora siempre es la de Santiago.
 */
export function DateTimeField({ label, mode, value, onChange, minimumDate, error }: Props) {
  const date = mode === "date" ? dateDesdeTexto(value) : dateDesdeTexto("2000-01-01", value);
  const texto = mode === "date" ? fechaLegible(value) : value;
  const minimo = minimumDate ? dateDesdeTexto(minimumDate, "00:00") : undefined;
  const aplicar = (seleccion?: Date) => {
    if (seleccion) {
      onChange(mode === "date" ? fechaDeDate(seleccion) : horaDeDate(seleccion));
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          minHeight: minTouch + 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: colors.field,
          borderWidth: error ? 1.5 : 0,
          borderColor: colors.danger,
        }}
      >
        <ThemedText variant="body">{label}</ThemedText>
        {process.env.EXPO_OS === "ios" ? (
          <DateTimePicker
            value={date}
            mode={mode}
            display="compact"
            locale="es-CL"
            minuteInterval={mode === "time" ? 5 : undefined}
            minimumDate={minimo}
            onChange={(_event, seleccion) => aplicar(seleccion)}
            accessibilityLabel={label}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${texto}`}
            accessibilityHint="Abre el selector"
            hitSlop={8}
            onPress={() =>
              DateTimePickerAndroid.open({
                value: date,
                mode,
                is24Hour: true,
                minimumDate: minimo,
                onChange: (event, seleccion) => {
                  if (event.type === "set") aplicar(seleccion);
                },
              })
            }
            style={({ pressed }) => ({ paddingVertical: spacing.sm, opacity: pressed ? 0.6 : 1 })}
          >
            <ThemedText style={[type.body, { color: colors.accent, fontVariant: ["tabular-nums"] }]}>{texto}</ThemedText>
          </Pressable>
        )}
      </View>
      {error ? (
        <ThemedText variant="footnote" selectable accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
