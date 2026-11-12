import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { View } from "react-native";
import { dateDesdeTexto, fechaDeDate, fechaLegible, horaDeDate } from "@/lib/tiempo";
import { radius, spacing, useTheme } from "@/theme";
import type { IconName } from "./icon";
import { ListRow } from "./section";
import { ThemedText } from "./themed-text";

type Props = {
  label: string;
  icon: IconName;
  mode: "date" | "time";
  /** "AAAA-MM-DD" para fechas y "HH:MM" para horas. */
  value: string;
  onChange: (value: string) => void;
  /** Fecha mínima seleccionable (solo para `mode="date"`). */
  minimumDate?: string;
  error?: boolean;
};

/**
 * Fila de fecha u hora dentro de un `Section`. En iOS usa el selector compacto nativo en línea; en
 * Android, la fila abre el diálogo del sistema. La hora siempre es la de Santiago.
 */
export function DateTimeField({ label, icon, mode, value, onChange, minimumDate, error }: Props) {
  const { colors, scheme } = useTheme();
  const date = mode === "date" ? dateDesdeTexto(value) : dateDesdeTexto("2000-01-01", value);
  const texto = mode === "date" ? fechaLegible(value) : value;
  const minimo = minimumDate ? dateDesdeTexto(minimumDate, "00:00") : undefined;
  const aplicar = (seleccion?: Date) => {
    if (seleccion) onChange(mode === "date" ? fechaDeDate(seleccion) : horaDeDate(seleccion));
  };

  const valor = (
    <View
      style={{
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <ThemedText variant="body" tone="accent" style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>
        {texto}
      </ThemedText>
    </View>
  );

  if (process.env.EXPO_OS === "ios") {
    return (
      <ListRow
        icon={icon}
        title={label}
        error={error}
        accessory={
          <DateTimePicker
            value={date}
            mode={mode}
            display="compact"
            locale="es-CL"
            themeVariant={scheme}
            accentColor={colors.accent}
            minuteInterval={mode === "time" ? 5 : undefined}
            minimumDate={minimo}
            onChange={(_event, seleccion) => aplicar(seleccion)}
            accessibilityLabel={label}
          />
        }
      />
    );
  }

  return (
    <ListRow
      icon={icon}
      title={label}
      error={error}
      accessibilityLabel={`${label}: ${texto}`}
      chevron={false}
      accessory={valor}
      accessibilityHint="Abre el selector"
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
    />
  );
}
