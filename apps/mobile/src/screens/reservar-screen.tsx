import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { nuevaClaveSolicitud, solicitarReserva } from "@/api/reservas";
import { Button } from "@/components/button";
import { DateTimeField } from "@/components/date-time-field";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { ReservaCard } from "@/components/reserva-card";
import { SelectRow } from "@/components/select-row";
import { ThemedText } from "@/components/themed-text";
import { ahoraEnSantiago } from "@/lib/tiempo";
import { useSolicitud } from "@/reserva/solicitud-provider";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

/** Destino y permanencia (03A) y solicitud de la plaza (04A). */
export default function ReservarScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useSession();
  const { fecha, llegada, salida, destino, actualizar } = useSolicitud();
  // Una clave por solicitud: si la respuesta se pierde y se reintenta, la API devuelve la misma reserva.
  const clave = useRef(nuevaClaveSolicitud());

  const reservar = useMutation({
    mutationFn: () =>
      solicitarReserva(token!, { fecha, llegada, salida, destinoId: destino?.id ?? null }, clave.current),
    onSuccess: () => {
      clave.current = nuevaClaveSolicitud();
      queryClient.invalidateQueries({ queryKey: ["reservas"] });
    },
  });
  const { message, fields } = describeError(reservar.error);
  // Cambiar los datos crea una solicitud nueva; lo ingresado se conserva.
  const cambiar = (cambios: Parameters<typeof actualizar>[0]) => {
    reservar.reset();
    clave.current = nuevaClaveSolicitud();
    actualizar(cambios);
  };

  if (reservar.data) {
    return (
      <FormScreen>
        <Notice
          tone="info"
          message={`Reserva confirmada. Al llegar, escanea el QR de la plaza ${reservar.data.reserva.plaza.codigo} en ${reservar.data.reserva.zona.nombre}.`}
        />
        <ReservaCard reserva={reservar.data.reserva} />
        <Button title="Ver mi reserva" onPress={() => router.navigate("/mi-reserva")} />
        <Button title="Nueva solicitud" variant="secondary" onPress={() => reservar.reset()} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <ThemedText variant="subhead">
        Indica a qué sala o edificio vas y cuánto tiempo estarás en el campus. Te asignaremos una plaza en el bloque más
        cercano a tu destino.
      </ThemedText>

      {message ? <Notice message={message} /> : null}

      <SelectRow
        label="Destino"
        placeholder="Elegir sala o edificio"
        value={destino?.nombre}
        detail={destino ? detalleDestino(destino) : undefined}
        onPress={() => {
          reservar.reset();
          router.push("/elegir-destino");
        }}
        error={fields.destinoId}
      />

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="subhead" style={{ fontWeight: "500" }}>
          Permanencia (hora de Santiago)
        </ThemedText>
        <DateTimeField
          label="Fecha"
          mode="date"
          value={fecha}
          minimumDate={ahoraEnSantiago().fecha}
          onChange={(valor) => cambiar({ fecha: valor })}
          error={fields.fecha}
        />
        <DateTimeField label="Llegada" mode="time" value={llegada} onChange={(valor) => cambiar({ llegada: valor })} error={fields.llegada} />
        <DateTimeField label="Salida" mode="time" value={salida} onChange={(valor) => cambiar({ salida: valor })} error={fields.salida} />
        {fields.vehiculoId ? <Notice message={fields.vehiculoId} /> : null}
      </View>

      <Button title="Reservar plaza" onPress={() => reservar.mutate()} loading={reservar.isPending} />
    </FormScreen>
  );
}
