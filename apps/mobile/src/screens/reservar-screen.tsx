import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { validarVisita } from "@/api/visitas";
import { Button } from "@/components/button";
import { DateTimeField } from "@/components/date-time-field";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { SelectRow } from "@/components/select-row";
import { ThemedText } from "@/components/themed-text";
import { ahoraEnSantiago, fechaLegible } from "@/lib/tiempo";
import { useSolicitud } from "@/reserva/solicitud-provider";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

/** Prepara la solicitud: destino, fecha y permanencia (03A). */
export default function ReservarScreen() {
  const router = useRouter();
  const { token } = useSession();
  const { fecha, llegada, salida, destino, actualizar } = useSolicitud();

  const preparar = useMutation({
    mutationFn: () => validarVisita(token!, { fecha, llegada, salida, destinoId: destino?.id ?? null }),
  });
  const { message, fields } = describeError(preparar.error);
  // Un cambio en el formulario invalida el resultado anterior, pero los datos se conservan.
  const cambiar = (cambios: Parameters<typeof actualizar>[0]) => {
    preparar.reset();
    actualizar(cambios);
  };

  return (
    <FormScreen>
      <ThemedText variant="subhead">
        Indica a qué sala o edificio vas y cuánto tiempo estarás en el campus. Asignaremos una plaza en el bloque más
        cercano a tu destino.
      </ThemedText>

      {message ? <Notice message={message} /> : null}

      <SelectRow
        label="Destino"
        placeholder="Elegir sala o edificio"
        value={destino?.nombre}
        detail={destino ? detalleDestino(destino) : undefined}
        onPress={() => {
          preparar.reset();
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
      </View>

      {preparar.data ? (
        <Notice
          tone="info"
          message={`Solicitud lista: ${preparar.data.visita.destino.nombre}, ${fechaLegible(preparar.data.visita.fecha)} de ${preparar.data.visita.llegada} a ${preparar.data.visita.salida}.`}
        />
      ) : null}

      <Button title="Continuar" onPress={() => preparar.mutate()} loading={preparar.isPending} />
    </FormScreen>
  );
}
