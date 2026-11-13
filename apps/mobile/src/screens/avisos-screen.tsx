import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { obtenerAvisos, type Aviso } from "@/api/avisos";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import type { IconName } from "@/components/icon";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { useNotificaciones } from "@/avisos/avisos-provider";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

const ICONOS: Record<Aviso["tipo"], IconName> = {
  confirmacion: "success",
  cancelacion: "cancel",
  cambio: "clock",
  sin_cupo: "error",
  espera_asignada: "parking",
  recordatorio_clase: "calendar",
  recordatorio_salida: "departure",
};

const fecha = (iso: string) => new Date(iso).toLocaleString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function entrega(aviso: Aviso) {
  if (aviso.estado === "enviado") return aviso.canal === "push" ? "Notificación enviada" : "Enviado por correo";
  if (aviso.estado === "fallido") return "No se pudo entregar: revisa aquí el estado de tu reserva";
  return "Envío pendiente";
}

/** Bandeja de avisos: el resultado de cada operación queda aquí aunque falle la notificación (06). */
export default function AvisosScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { token } = useSession();
  const notificaciones = useNotificaciones();
  const avisos = useQuery({ queryKey: ["avisos"], queryFn: () => obtenerAvisos(token!), enabled: Boolean(token), refetchInterval: 60_000 });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
      refreshControl={<RefreshControl refreshing={avisos.isRefetching} onRefresh={() => avisos.refetch()} tintColor={colors.accent} />}
    >
      {notificaciones?.estado === "activas" ? null : notificaciones ? (
        <Notice
          tone="info"
          message={
            notificaciones.estado === "sin_permiso"
              ? "Las notificaciones están desactivadas. Recibirás los avisos por correo institucional y aquí."
              : "Este entorno no recibe notificaciones (por ejemplo, Expo Go). Recibirás los avisos por correo institucional y aquí."
          }
        />
      ) : null}
      {avisos.isLoading ? <ActivityIndicator accessibilityLabel="Cargando avisos" color={colors.accent} /> : null}
      {avisos.error ? (
        <View style={{ gap: spacing.md }}>
          <Notice message={describeError(avisos.error).message ?? "No se pudieron cargar los avisos."} />
          <Button title="Reintentar" variant="secondary" onPress={() => avisos.refetch()} />
        </View>
      ) : null}
      {avisos.data && avisos.data.avisos.length === 0 ? (
        <EmptyState icon="info" title="Sin avisos" message="Aquí verás la confirmación de tus reservas, sus cambios y los recordatorios de salida." />
      ) : null}
      {avisos.data && avisos.data.avisos.length > 0 ? (
        <Section title="Recibidos">
          {avisos.data.avisos.map((a) => (
            <ListRow
              key={a.id}
              icon={ICONOS[a.tipo]}
              tone={a.tipo === "sin_cupo" || a.tipo === "cancelacion" ? "danger" : "default"}
              title={a.titulo}
              detail={`${a.cuerpo}\n${fecha(a.programadoEn)} · ${entrega(a)}`}
              onPress={a.reservaId ? () => router.navigate("/mi-reserva") : undefined}
            />
          ))}
        </Section>
      ) : null}
      {avisos.data && avisos.data.programados.length > 0 ? (
        <Section title="Programados" footer="Se cancelan si cancelas la reserva o registras tu salida.">
          {avisos.data.programados.map((p) => (
            <ListRow key={p.id} icon={ICONOS[p.tipo]} title={p.titulo} detail={fecha(p.programadoEn)} />
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}
