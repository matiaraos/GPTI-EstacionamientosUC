import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { ApiError } from "@/api/client";
import { nuevaClaveSolicitud, solicitarReserva, unirseAEspera } from "@/api/reservas";
import { Button } from "@/components/button";
import { DateTimeField } from "@/components/date-time-field";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { ReservaCard } from "@/components/reserva-card";
import { FieldError, ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { useClasesDeVisita } from "@/horario/clases-de-visita";
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

  // Con clases en ese horario, la API usa la sala de la primera y desempata con la de la última.
  const clases = useClasesDeVisita(fecha, llegada, salida);
  const porHorario = clases.length > 0;
  const datos = { fecha, llegada, salida, destinoId: porHorario ? null : (destino?.id ?? null) };

  const reservar = useMutation({
    mutationFn: () => solicitarReserva(token!, datos, clave.current),
    onSuccess: () => {
      clave.current = nuevaClaveSolicitud();
      queryClient.invalidateQueries({ queryKey: ["reservas"] });
    },
  });
  const espera = useMutation({
    mutationFn: () => unirseAEspera(token!, datos, clave.current),
    onSuccess: () => {
      clave.current = nuevaClaveSolicitud();
      queryClient.invalidateQueries({ queryKey: ["esperas"] });
      queryClient.invalidateQueries({ queryKey: ["reservas"] });
    },
  });
  const sinCupo = reservar.error instanceof ApiError && reservar.error.code === "sin_cupo";
  const { message, fields } = describeError(espera.error ?? reservar.error);
  // Cambiar los datos crea una solicitud nueva; lo ingresado se conserva.
  const cambiar = (cambios: Parameters<typeof actualizar>[0]) => {
    reservar.reset();
    espera.reset();
    clave.current = nuevaClaveSolicitud();
    actualizar(cambios);
  };
  const confirmarEspera = () =>
    Alert.alert(
      "¿Unirte a la lista de espera?",
      "Si se libera una plaza compatible con tu horario, te la asignaremos automáticamente. Puedes salir de la lista desde Mi reserva.",
      [
        { text: "No, gracias", style: "cancel" },
        { text: "Unirme", onPress: () => espera.mutate() },
      ],
    );

  if (espera.data) {
    const { espera: e } = espera.data;
    return (
      <FormScreen>
        <Notice
          tone={e.estado === "asignada" ? "success" : "info"}
          message={
            e.estado === "asignada"
              ? "Se liberó una plaza y ya te la asignamos. Revísala en Mi reserva."
              : `Quedaste en la lista de espera para el ${e.fecha} de ${e.llegada} a ${e.salida}. Si se libera una plaza, te la asignaremos.`
          }
        />
        <View style={{ gap: spacing.sm }}>
          <Button title="Ver Mi reserva" icon="car" onPress={() => router.navigate("/mi-reserva")} />
          <Button title="Hacer otra solicitud" variant="secondary" onPress={() => cambiar({})} />
        </View>
      </FormScreen>
    );
  }

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
        <Section
          title="Destino"
          footer={porHorario ? "Según tu horario. Para declarar otro destino, cambia la hora o edita tu horario." : undefined}
        >
          {porHorario ? (
            clases.map((clase, i) => (
              <ListRow
                key={clase.id}
                icon={clase.destino.tipo === "edificio" ? "building" : "room"}
                title={clase.destino.nombre}
                detail={`${i === 0 ? "Primera clase" : i === clases.length - 1 ? "Última clase" : "Clase"} · ${clase.inicio}–${clase.fin}${clase.titulo ? ` · ${clase.titulo}` : ""}`}
              />
            ))
          ) : (
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
          )}
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

      <View style={{ gap: spacing.sm }}>
        <Button title="Reservar plaza" icon="parking" onPress={() => reservar.mutate()} loading={reservar.isPending} />
        {sinCupo ? (
          <Button title="Unirme a la lista de espera" variant="secondary" icon="clock" onPress={confirmarEspera} loading={espera.isPending} />
        ) : null}
      </View>

      <Section>
        <ListRow icon="calendar" title="Reservas semanales" detail="Fija tus días y horario de cada semana" onPress={() => router.push("/series")} />
      </Section>
    </FormScreen>
  );
}
