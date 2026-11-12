import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { describeError } from "@/api/errors";
import { cambiarReserva, nuevaClaveSolicitud } from "@/api/reservas";
import { Button } from "@/components/button";
import { DateTimeField } from "@/components/date-time-field";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { ReservaCard } from "@/components/reserva-card";
import { FieldError, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { ahoraEnSantiago } from "@/lib/tiempo";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

/** Cambia la fecha u horario de una reserva confirmada. Si no hay plaza, la reserva actual se mantiene. */
export default function CambiarReservaScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useSession();
  const params = useLocalSearchParams<{ id: string; fecha: string; llegada: string; salida: string; destinoId: string }>();
  const [fecha, setFecha] = useState(params.fecha);
  const [llegada, setLlegada] = useState(params.llegada);
  const [salida, setSalida] = useState(params.salida);
  const clave = useRef(nuevaClaveSolicitud());

  const cambio = useMutation({
    mutationFn: () => cambiarReserva(token!, Number(params.id), { fecha, llegada, salida, destinoId: Number(params.destinoId) }, clave.current),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["reservas"] }),
  });
  const { message, fields } = describeError(cambio.error);
  const editar = (aplicar: () => void) => {
    cambio.reset();
    clave.current = nuevaClaveSolicitud();
    aplicar();
  };

  if (cambio.data) {
    return (
      <FormScreen>
        <Notice tone="success" message="Listo. Tu reserva anterior quedó cancelada y esta es la nueva." />
        <ReservaCard reserva={cambio.data.reserva} />
        <Button title="Volver a Mi reserva" onPress={() => router.back()} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <ThemedText variant="callout" tone="secondary">
        Buscaremos una plaza para el nuevo horario. Tu reserva actual se mantiene hasta que la alternativa quede confirmada.
      </ThemedText>
      {message ? <Notice message={`${message} Tu reserva actual no cambió.`} /> : null}
      <View style={{ gap: spacing.sm }}>
        <Section title="Nuevo horario">
          <DateTimeField label="Fecha" icon="calendar" mode="date" value={fecha} minimumDate={ahoraEnSantiago().fecha} onChange={(v) => editar(() => setFecha(v))} error={Boolean(fields.fecha)} />
          <DateTimeField label="Llegada" icon="arrival" mode="time" value={llegada} onChange={(v) => editar(() => setLlegada(v))} error={Boolean(fields.llegada)} />
          <DateTimeField label="Salida" icon="departure" mode="time" value={salida} onChange={(v) => editar(() => setSalida(v))} error={Boolean(fields.salida)} />
        </Section>
        <FieldError message={fields.fecha ?? fields.llegada ?? fields.salida} />
      </View>
      <Button title="Confirmar cambio" onPress={() => cambio.mutate()} loading={cambio.isPending} />
    </FormScreen>
  );
}
