import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { cancelarReserva, reservasVigentes, type Reserva } from "@/api/reservas";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { ReservaCard } from "@/components/reserva-card";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

function Acciones({ reserva }: { reserva: Reserva }) {
  const router = useRouter();
  const { token } = useSession();
  const queryClient = useQueryClient();
  const cancelar = useMutation({
    mutationFn: () => cancelarReserva(token!, reserva.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["reservas"] }),
  });

  const confirmar = () =>
    Alert.alert("¿Cancelar la reserva?", `Se liberará la plaza ${reserva.plaza.codigo} para ese horario.`, [
      { text: "Mantener", style: "cancel" },
      { text: "Cancelar reserva", style: "destructive", onPress: () => cancelar.mutate() },
    ]);

  return (
    <View style={{ gap: spacing.sm }}>
      {cancelar.error ? <Notice message={describeError(cancelar.error).message ?? "No se pudo cancelar."} /> : null}
      {reserva.estado === "confirmada" ? (
        <>
          <Button
            title="Registrar llegada"
            onPress={() => router.push({ pathname: "/escanear", params: { reserva: reserva.id, tipo: "entrada" } })}
          />
          <Button title="Cancelar reserva" variant="destructive" onPress={confirmar} loading={cancelar.isPending} />
        </>
      ) : null}
      {reserva.estado === "en_uso" ? (
        <Button
          title="Registrar salida"
          onPress={() => router.push({ pathname: "/escanear", params: { reserva: reserva.id, tipo: "salida" } })}
        />
      ) : null}
    </View>
  );
}

/** Reservas vigentes de la cuenta, con cancelación antes del check-in. */
export default function MiReservaScreen() {
  const router = useRouter();
  const { token } = useSession();
  const reservas = useQuery({
    queryKey: ["reservas", "vigentes"],
    queryFn: () => reservasVigentes(token!),
    enabled: Boolean(token),
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={reservas.isRefetching} onRefresh={() => reservas.refetch()} />}
    >
      {reservas.isLoading ? <ActivityIndicator accessibilityLabel="Cargando tus reservas" style={{ padding: spacing.xl }} /> : null}

      {reservas.error ? (
        <View style={{ gap: spacing.md }}>
          <Notice message={describeError(reservas.error).message ?? "No se pudieron cargar tus reservas."} />
          <Button title="Reintentar" variant="secondary" onPress={() => reservas.refetch()} loading={reservas.isFetching} />
        </View>
      ) : null}

      {reservas.data && reservas.data.reservas.length === 0 ? (
        <View style={{ gap: spacing.md }}>
          <ThemedText variant="subhead">No tienes reservas vigentes.</ThemedText>
          <Button title="Reservar una plaza" onPress={() => router.navigate("/")} />
        </View>
      ) : null}

      {reservas.data?.reservas.map((reserva) => (
        <ReservaCard key={reserva.id} reserva={reserva}>
          <Acciones reserva={reserva} />
        </ReservaCard>
      ))}
    </ScrollView>
  );
}
