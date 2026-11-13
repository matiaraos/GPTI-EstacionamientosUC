import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { DIAS } from "@/api/horario";
import { cancelarReserva } from "@/api/reservas";
import { cancelarSerie, elegibilidadSerie, misSeries, type Serie } from "@/api/series";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { fechaLegible } from "@/lib/tiempo";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

const ESTADOS: Record<Serie["estado"], string> = { activa: "Activa", revocada: "Revocada", cancelada: "Cancelada" };

/** Reservas semanales (07): requisitos, series y sus próximas fechas, con cancelación por fecha o serie. */
export default function SeriesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { token } = useSession();
  const series = useQuery({ queryKey: ["series"], queryFn: () => misSeries(token!), enabled: Boolean(token) });
  const elegibilidad = useQuery({ queryKey: ["series", "elegibilidad"], queryFn: () => elegibilidadSerie(token!), enabled: Boolean(token) });
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["series"] });
    void queryClient.invalidateQueries({ queryKey: ["reservas"] });
  };
  const cancelarFecha = useMutation({ mutationFn: (id: number) => cancelarReserva(token!, id), onSuccess: refrescar });
  const cancelarTodo = useMutation({ mutationFn: (id: number) => cancelarSerie(token!, id), onSuccess: refrescar });
  const e = elegibilidad.data;
  const error = series.error ?? elegibilidad.error ?? cancelarFecha.error ?? cancelarTodo.error;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
      refreshControl={<RefreshControl refreshing={series.isRefetching} onRefresh={refrescar} tintColor={colors.accent} />}
    >
      <ThemedText variant="callout" tone="secondary">
        Fija tus bloques de la semana y no reserves cada día. Las fechas se renuevan el fin de semana si cumpliste: una
        ausencia revoca el beneficio.
      </ThemedText>
      {error ? <Notice message={describeError(error).message ?? "No se pudo cargar."} /> : null}

      {e ? (
        <Section title="Requisitos" footer={e.zona ? `Solo el ${e.zona.porcentaje} % de las plazas de la zona piloto se destina a reservas semanales.` : undefined}>
          <ListRow icon="star" title="Tu puntaje" value={`${e.puntaje} / mín. ${e.umbral}`} tone={e.puntaje >= e.umbral ? "default" : "danger"} />
          <ListRow icon="calendar" title="Bloques semanales" value={`${e.bloques.usados} de ${e.bloques.maximo}`} />
          {e.zona ? <ListRow icon="parking" title={e.zona.nombre} value={`${e.zona.usadas} de ${e.zona.tope} plazas`} /> : null}
        </Section>
      ) : null}

      {series.isLoading ? <ActivityIndicator accessibilityLabel="Cargando" color={colors.accent} /> : null}
      {series.data && series.data.series.length === 0 ? (
        <EmptyState icon="calendar" title="Sin reservas semanales" message="Crea una para asegurar tu plaza los mismos días de cada semana." />
      ) : null}

      {series.data?.series.map((s) => (
        <Section
          key={s.id}
          title={`${ESTADOS[s.estado]} · ${s.zona.nombre}`}
          footer={s.motivoCierre ?? (s.estado === "activa" ? "Para no ir un día, cancela esa fecha: la serie sigue activa." : undefined)}
        >
          {s.bloques.map((b) => (
            <ListRow key={b.id} icon="clock" title={`${DIAS[b.diaSemana - 1]} ${b.llegada}–${b.salida}`} detail={b.destino.nombre} />
          ))}
          {s.ocurrencias.map((o) => (
            <ListRow
              key={o.id}
              icon={o.estado === "cancelada" ? "cancel" : "parking"}
              tone={o.estado === "cancelada" ? "danger" : "default"}
              title={`${fechaLegible(o.fecha)} · plaza ${o.plaza.codigo}`}
              detail={o.estado === "confirmada" ? "Toca para cancelar solo esta fecha" : o.estado === "cancelada" ? "Fecha cancelada" : o.estado}
              chevron={false}
              onPress={
                o.estado === "confirmada"
                  ? () =>
                      Alert.alert("¿Cancelar esta fecha?", "Tu reserva semanal sigue activa para las demás.", [
                        { text: "Mantener", style: "cancel" },
                        { text: "Cancelar fecha", style: "destructive", onPress: () => cancelarFecha.mutate(o.id) },
                      ])
                  : undefined
              }
            />
          ))}
          {s.estado === "activa" ? (
            <ListRow
              icon="cancel"
              title="Cancelar reserva semanal"
              tone="danger"
              onPress={() =>
                Alert.alert("¿Cancelar la reserva semanal?", "Se liberarán todas tus fechas futuras.", [
                  { text: "Mantener", style: "cancel" },
                  { text: "Cancelar serie", style: "destructive", onPress: () => cancelarTodo.mutate(s.id) },
                ])
              }
            />
          ) : null}
        </Section>
      ))}

      <View style={{ gap: spacing.sm }}>
        <Button title="Nueva reserva semanal" icon="calendar" disabled={e ? !e.elegible : true} onPress={() => router.push("/nueva-serie")} />
        {e && !e.elegible ? (
          <ThemedText variant="footnote" style={{ textAlign: "center" }}>
            {e.puntaje < e.umbral
              ? "Necesitas más puntaje. Puedes seguir reservando por día."
              : e.zona && e.zona.usadas >= e.zona.tope
                ? "La zona piloto no tiene cupo semanal. Puedes seguir reservando por día."
                : "Ya usaste todos tus bloques semanales."}
          </ThemedText>
        ) : null}
      </View>
    </ScrollView>
  );
}
