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
import { FieldError, ListRow, Section } from "@/components/section";
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
    mutationFn: () => solicitarReserva(token!, { fecha, llegada, salida, destinoId: destino?.id ?? null }, clave.current),
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
    const { reserva } = reservar.data;
    return (
      <FormScreen>
        <Notice
          tone="success"
          message={`Reserva confirmada. Al llegar, escanea el QR de la plaza ${reserva.plaza.codigo} en ${reserva.zona.nombre}.`}
        />
        <ReservaCard reserva={reserva} />
        <View style={{ gap: spacing.sm }}>
          <Button title="Ver mi reserva" icon="car" onPress={() => router.navigate("/mi-reserva")} />
          <Button title="Hacer otra solicitud" variant="secondary" onPress={() => reservar.reset()} />
        </View>
      </FormScreen>
    );
  }

  const errorHorario = fields.fecha ?? fields.llegada ?? fields.salida;

  return (
    <FormScreen>
      <ThemedText variant="callout" tone="secondary">
        Indica a qué sala o edificio vas y cuánto tiempo estarás. Te asignamos una plaza en el bloque más cercano a tu
        destino.
      </ThemedText>

      {message ? <Notice message={message} /> : null}

      <View style={{ gap: spacing.sm }}>
        <Section title="Destino">
          <ListRow
            icon={destino?.tipo === "edificio" ? "building" : destino ? "room" : "pin"}
            title={destino ? destino.nombre : "Elegir sala o edificio"}
            detail={destino ? detalleDestino(destino) : "Busca por código o nombre"}
            tone={destino ? "default" : "accent"}
            error={Boolean(fields.destinoId)}
            accessibilityHint="Abre la búsqueda de destinos"
            onPress={() => {
              reservar.reset();
              router.push("/elegir-destino");
            }}
          />
        </Section>
        <FieldError message={fields.destinoId} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Section title="Permanencia" footer="Horas de Santiago. Puedes registrar tu llegada desde 15 minutos antes.">
          <DateTimeField
            label="Fecha"
            icon="calendar"
            mode="date"
            value={fecha}
            minimumDate={ahoraEnSantiago().fecha}
            onChange={(valor) => cambiar({ fecha: valor })}
            error={Boolean(fields.fecha)}
          />
          <DateTimeField
            label="Llegada"
            icon="arrival"
            mode="time"
            value={llegada}
            onChange={(valor) => cambiar({ llegada: valor })}
            error={Boolean(fields.llegada)}
          />
          <DateTimeField
            label="Salida"
            icon="departure"
            mode="time"
            value={salida}
            onChange={(valor) => cambiar({ salida: valor })}
            error={Boolean(fields.salida)}
          />
        </Section>
        <FieldError message={errorHorario} />
        {fields.vehiculoId ? <Notice message={fields.vehiculoId} /> : null}
      </View>

      <Button title="Reservar plaza" icon="parking" onPress={() => reservar.mutate()} loading={reservar.isPending} />
    </FormScreen>
  );
}
