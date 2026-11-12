import type { ReactNode } from "react";
import { View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { distanciaLegible, type Reserva } from "@/api/reservas";
import { fechaLegible } from "@/lib/tiempo";
import { colors, radius, spacing } from "@/theme";
import { ThemedText } from "./themed-text";

const ESTADOS: Record<Reserva["estado"], string> = {
  confirmada: "Confirmada",
  en_uso: "En uso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <ThemedText variant="footnote">{label}</ThemedText>
      <ThemedText variant="body" selectable>
        {value}
      </ThemedText>
    </View>
  );
}

/** Resumen de una reserva: bloque, plaza, horario y distancia con su método. */
export function ReservaCard({ reserva, children }: { reserva: Reserva; children?: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="footnote">Plaza</ThemedText>
          <ThemedText variant="largeTitle" selectable>
            {reserva.plaza.codigo}
          </ThemedText>
        </View>
        <ThemedText
          variant="footnote"
          style={{
            color: reserva.estado === "cancelada" ? colors.danger : colors.success,
            fontWeight: "600",
            paddingTop: spacing.xs,
          }}
        >
          {ESTADOS[reserva.estado]}
        </ThemedText>
      </View>
      <Dato label="Bloque" value={reserva.zona.nombre} />
      <Dato label="Horario" value={`${fechaLegible(reserva.fecha)}, de ${reserva.llegada} a ${reserva.salida}`} />
      <Dato label="Destino" value={`${reserva.destino.nombre} · ${detalleDestino({ ...reserva.destino, pisos: [] })}`} />
      <Dato label="Distancia estimada" value={distanciaLegible(reserva)} />
      <Dato label="Vehículo" value={reserva.vehiculo.patente} />
      {children}
    </View>
  );
}
