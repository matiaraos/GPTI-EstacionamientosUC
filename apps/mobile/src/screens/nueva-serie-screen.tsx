import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { crearSerie } from "@/api/series";
import { nuevaClaveSolicitud } from "@/api/reservas";
import { Button } from "@/components/button";
import { DateTimeField } from "@/components/date-time-field";
import { DaysPicker } from "@/components/day-picker";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { FieldError, ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { useSerie } from "@/reserva/serie-provider";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

/** Crea una reserva semanal: días, horario y destino (o el de tus clases de cada día). */
export default function NuevaSerieScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useSession();
  const { dias, llegada, salida, destino, actualizar, reiniciar } = useSerie();
  const clave = useRef(nuevaClaveSolicitud());
  const crear = useMutation({
    mutationFn: () =>
      crearSerie(
        token!,
        dias.map((diaSemana) => ({ diaSemana, llegada, salida, destinoId: destino?.id ?? null })),
        clave.current,
      ),
    onSuccess: () => {
      reiniciar();
      clave.current = nuevaClaveSolicitud();
      void queryClient.invalidateQueries({ queryKey: ["series"] });
      void queryClient.invalidateQueries({ queryKey: ["reservas"] });
      router.back();
    },
  });
  const { message, fields } = describeError(crear.error);
  const errorBloques = Object.entries(fields).find(([k]) => k.startsWith("bloques"))?.[1];
  const cambiar = (c: Parameters<typeof actualizar>[0]) => {
    crear.reset();
    clave.current = nuevaClaveSolicitud();
    actualizar(c);
  };

  return (
    <FormScreen>
      <ThemedText variant="callout" tone="secondary">
        Reservaremos tu plaza en la zona piloto cada semana, en estos días y horario. Empieza el próximo lunes.
      </ThemedText>
      {message ? <Notice message={message} /> : null}

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="overline" style={{ paddingHorizontal: spacing.md }}>
          Días
        </ThemedText>
        <DaysPicker value={dias} onChange={(d) => cambiar({ dias: d })} />
      </View>

      <Section title="Horario" footer="Horas de Santiago, iguales para todos los días elegidos.">
        <DateTimeField label="Llegada" icon="arrival" mode="time" value={llegada} onChange={(v) => cambiar({ llegada: v })} />
        <DateTimeField label="Salida" icon="departure" mode="time" value={salida} onChange={(v) => cambiar({ salida: v })} />
      </Section>

      <View style={{ gap: spacing.sm }}>
        <Section title="Destino" footer={destino ? undefined : "Sin destino, usamos la sala de tu primera clase de cada día."}>
          <ListRow
            icon={destino ? (destino.tipo === "edificio" ? "building" : "room") : "calendar"}
            title={destino ? destino.nombre : "Según mi horario"}
            detail={destino ? detalleDestino(destino) : "Toca para elegir una sala o edificio"}
            onPress={() => router.push("/serie-destino")}
          />
          {destino ? <ListRow icon="cancel" title="Usar mi horario" tone="accent" onPress={() => cambiar({ destino: null })} /> : null}
        </Section>
        <FieldError message={errorBloques} />
      </View>

      <Button title={`Reservar ${dias.length} ${dias.length === 1 ? "día" : "días"} cada semana`} onPress={() => crear.mutate()} disabled={dias.length === 0} loading={crear.isPending} />
    </FormScreen>
  );
}
