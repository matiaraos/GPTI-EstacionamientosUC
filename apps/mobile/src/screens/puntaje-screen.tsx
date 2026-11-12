import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { obtenerRanking, TITULOS } from "@/api/ranking";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { fechaLegible } from "@/lib/tiempo";
import { useSession } from "@/session/session-provider";
import { radius, spacing, useTheme } from "@/theme";

/** Puntaje de ranking e historial de ajustes con su motivo y reserva (05B). */
export default function PuntajeScreen() {
  const { colors } = useTheme();
  const { token } = useSession();
  const ranking = useQuery({ queryKey: ["ranking"], queryFn: () => obtenerRanking(token!), enabled: Boolean(token) });
  const datos = ranking.data;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
      refreshControl={<RefreshControl refreshing={ranking.isRefetching} onRefresh={() => ranking.refetch()} tintColor={colors.accent} />}
    >
      {ranking.isLoading ? <ActivityIndicator accessibilityLabel="Cargando tu puntaje" color={colors.accent} /> : null}
      {ranking.error ? (
        <View style={{ gap: spacing.md }}>
          <Notice message={describeError(ranking.error).message ?? "No se pudo cargar tu puntaje."} />
          <Button title="Reintentar" variant="secondary" onPress={() => ranking.refetch()} />
        </View>
      ) : null}

      {datos ? (
        <>
          <View
            accessible
            accessibilityLabel={`Tu puntaje es ${datos.puntaje}`}
            style={{ alignItems: "center", gap: spacing.xs, padding: spacing.lg, borderRadius: radius.xl, borderCurve: "continuous", backgroundColor: colors.surface }}
          >
            <ThemedText variant="overline">Puntaje</ThemedText>
            <ThemedText variant="display" tone="accent" style={{ fontVariant: ["tabular-nums"] }}>
              {datos.puntaje}
            </ThemedText>
            <ThemedText variant="footnote" style={{ textAlign: "center" }}>
              Partiste con {datos.puntajeInicial}. Cuando dos solicitudes compiten por la misma plaza, se atiende primero el mayor puntaje.
            </ThemedText>
          </View>

          {datos.ajustes.length === 0 ? (
            <EmptyState icon="star" title="Sin ajustes" message="Registra tu llegada y tu salida con el QR para mantener tu puntaje." />
          ) : (
            <Section title="Historial" footer="Una lectura fallida del QR no descuenta puntos. Las sanciones por mal uso las valida administración.">
              {datos.ajustes.map((a) => (
                <ListRow
                  key={a.id}
                  icon={a.variacion >= 0 ? "up" : "down"}
                  tone={a.variacion >= 0 ? "default" : "danger"}
                  title={`${a.variacion > 0 ? "+" : ""}${a.variacion} · ${TITULOS[a.tipo]}`}
                  detail={[
                    a.motivo,
                    a.reserva ? `Reserva del ${fechaLegible(a.reserva.fecha)}, ${a.reserva.llegada}–${a.reserva.salida}, plaza ${a.reserva.plaza}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                />
              ))}
            </Section>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
