import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { cancelarEspera, cancelarReserva, misEsperas, reservasVigentes, type Espera, type Reserva } from "@/api/reservas";
import { ListRow, Section } from "@/components/section";
import { fechaLegible } from "@/lib/tiempo";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ReservaCard } from "@/components/reserva-card";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

function Acciones({ reserva }: { reserva: Reserva }) {
  const router = useRouter();
  const { token } = useSession();
  const queryClient = useQueryClient();
  const cancelar = useMutation({
    mutationFn: () => cancelarReserva(token!, reserva.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["reservas"] }),
  });

  // Cancelar libera la plaza para otras personas y no se puede deshacer: amerita confirmación nativa.
  const confirmar = () =>
    Alert.alert("¿Cancelar la reserva?", `Se liberará la plaza ${reserva.plaza.codigo} para ese horario.`, [
      { text: "Mantener", style: "cancel" },
      { text: "Cancelar reserva", style: "destructive", onPress: () => cancelar.mutate() },
    ]);

  const escanear = (tipo: "entrada" | "salida") =>
    router.push({ pathname: "/escanear", params: { reserva: reserva.id, tipo } });

  return (
    <>
      {cancelar.error ? <Notice message={describeError(cancelar.error).message ?? "No se pudo cancelar."} /> : null}
      {reserva.estado === "confirmada" ? (
        <>
          <Button title="Registrar llegada" icon="qr" onPress={() => escanear("entrada")} />
          <Button
            title="Cambiar horario"
            variant="secondary"
            icon="clock"
            onPress={() =>
              router.push({
                pathname: "/cambiar-reserva",
                params: { id: reserva.id, fecha: reserva.fecha, llegada: reserva.llegada, salida: reserva.salida, destinoId: reserva.destino.id },
              })
            }
          />
          <Button title="Cancelar reserva" variant="destructive" onPress={confirmar} loading={cancelar.isPending} />
        </>
      ) : null}
      {reserva.estado === "en_uso" ? <Button title="Registrar salida" icon="qr" onPress={() => escanear("salida")} /> : null}
    </>
  );
}

const ESTADO_ESPERA: Record<Espera["estado"], string> = {
  pendiente: "En espera",
  asignada: "Plaza asignada",
  cancelada: "Saliste de la lista",
  vencida: "Venció sin plaza",
};

function Esperas() {
  const { token } = useSession();
  const queryClient = useQueryClient();
  const esperas = useQuery({ queryKey: ["esperas"], queryFn: () => misEsperas(token!), enabled: Boolean(token) });
  const salir = useMutation({
    mutationFn: (id: number) => cancelarEspera(token!, id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["esperas"] }),
  });
  const visibles = (esperas.data?.esperas ?? []).filter((e) => e.estado === "pendiente" || e.estado === "vencida");
  if (visibles.length === 0) return null;
  return (
    <Section title="Lista de espera" footer="Si se libera una plaza compatible, se asigna automáticamente y aparece arriba.">
      {visibles.map((e) => (
        <ListRow
          key={e.id}
          icon="clock"
          title={`${ESTADO_ESPERA[e.estado]} · ${e.llegada}–${e.salida}`}
          detail={`${fechaLegible(e.fecha)} · ${e.destino.nombre}`}
          tone={e.estado === "pendiente" ? "default" : "danger"}
          chevron={false}
          onPress={
            e.estado === "pendiente"
              ? () =>
                  Alert.alert("¿Salir de la lista de espera?", "Ya no se te asignará una plaza para ese horario.", [
                    { text: "Seguir esperando", style: "cancel" },
                    { text: "Salir", style: "destructive", onPress: () => salir.mutate(e.id) },
                  ])
              : undefined
          }
          accessibilityHint={e.estado === "pendiente" ? "Permite salir de la lista" : undefined}
        />
      ))}
    </Section>
  );
}

/** Reservas vigentes de la cuenta, con llegada, salida, cambio y cancelación, y la lista de espera. */
export default function MiReservaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { token } = useSession();
  const reservas = useQuery({
    queryKey: ["reservas", "vigentes"],
    queryFn: () => reservasVigentes(token!),
    enabled: Boolean(token),
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={reservas.isRefetching} onRefresh={() => reservas.refetch()} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      {reservas.isLoading ? <ActivityIndicator accessibilityLabel="Cargando tus reservas" color={colors.accent} style={{ padding: spacing.xl }} /> : null}

      {reservas.error ? (
        <View style={{ gap: spacing.md }}>
          <Notice message={describeError(reservas.error).message ?? "No se pudieron cargar tus reservas."} />
          <Button title="Reintentar" variant="secondary" onPress={() => reservas.refetch()} loading={reservas.isFetching} />
        </View>
      ) : null}

      <Esperas />

      {reservas.data && reservas.data.reservas.length === 0 ? (
        <EmptyState
          icon="empty"
          title="Sin reservas vigentes"
          message="Cuando reserves una plaza, aquí verás su código, horario y el acceso para registrar tu llegada."
          action={<Button title="Reservar una plaza" icon="parking" onPress={() => router.navigate("/")} />}
        />
      ) : null}

      {reservas.data?.reservas.map((reserva) => (
        <ReservaCard key={reserva.id} reserva={reserva}>
          <Acciones reserva={reserva} />
        </ReservaCard>
      ))}
    </ScrollView>
  );
}
