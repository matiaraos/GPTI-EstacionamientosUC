import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { distanciaLegible, type Reserva } from "@/api/reservas";
import { fechaLegible } from "@/lib/tiempo";
import { radius, spacing, useTheme, type Palette } from "@/theme";
import { Icon, type IconName } from "./icon";
import { ThemedText } from "./themed-text";

const ESTADOS: Record<Reserva["estado"], { texto: string; icono: IconName }> = {
  confirmada: { texto: "Confirmada", icono: "success" },
  en_uso: { texto: "En uso", icono: "car" },
  finalizada: { texto: "Finalizada", icono: "success" },
  cancelada: { texto: "Cancelada", icono: "cancel" },
  ausente: { texto: "Sin llegada", icono: "error" },
  vencida: { texto: "Salida vencida", icono: "error" },
};

function colorEstado(colors: Palette, estado: Reserva["estado"]) {
  if (estado === "cancelada" || estado === "ausente" || estado === "vencida") return { fondo: colors.dangerSoft, texto: colors.danger };
  if (estado === "en_uso") return { fondo: colors.warningSoft, texto: colors.warning };
  return { fondo: colors.successSoft, texto: colors.success };
}

function Dato({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} color={colors.tertiaryLabel} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <ThemedText variant="footnote">{label}</ThemedText>
        <ThemedText variant="callout" selectable style={{ fontWeight: "500" }}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Reserva como un ticket: la plaza y el bloque destacados sobre el color de marca (para saber qué
 * QR escanear) y, debajo, horario, destino, distancia y vehículo.
 */
export function ReservaCard({ reserva, children }: { reserva: Reserva; children?: ReactNode }) {
  const { colors } = useTheme();
  const estado = colorEstado(colors, reserva.estado);
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderCurve: "continuous", overflow: "hidden" }}>
      <View style={{ backgroundColor: colors.accent, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <ThemedText variant="overline" tone="onAccent" style={{ opacity: 0.85 }}>
            Tu plaza
          </ThemedText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
              backgroundColor: estado.fondo,
            }}
          >
            <Icon name={ESTADOS[reserva.estado].icono} size={14} color={estado.texto} />
            <ThemedText variant="footnote" style={{ color: estado.texto, fontWeight: "700" }}>
              {ESTADOS[reserva.estado].texto}
            </ThemedText>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <ThemedText variant="display" tone="onAccent" selectable style={{ fontVariant: ["tabular-nums"] }}>
            {reserva.plaza.codigo}
          </ThemedText>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
              <Icon name="parking" size={16} color={colors.onAccent} />
              <ThemedText variant="footnote" tone="onAccent" style={{ opacity: 0.85 }}>
                Bloque
              </ThemedText>
            </View>
            <ThemedText variant="headline" tone="onAccent" selectable>
              {reserva.zona.nombre}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Perforación del ticket */}
      <View style={{ height: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.separator }} />

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Dato icon="calendar" label="Horario" value={`${fechaLegible(reserva.fecha)}, ${reserva.llegada}–${reserva.salida}`} />
        <Dato
          icon={reserva.destino.tipo === "edificio" ? "building" : "room"}
          label="Destino"
          value={reserva.destino.tipo === "edificio" ? reserva.destino.nombre : `${reserva.destino.nombre} · ${reserva.destino.idOrigen}`}
        />
        <Dato icon="walk" label="Distancia estimada" value={distanciaLegible(reserva)} />
        <Dato icon="car" label="Vehículo" value={reserva.vehiculo.patente} />
        {children ? <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>{children}</View> : null}
      </View>
    </View>
  );
}
