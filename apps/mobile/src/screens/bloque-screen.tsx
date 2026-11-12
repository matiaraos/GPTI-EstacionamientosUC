import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { crearBloque, editarBloque, eliminarBloque } from "@/api/horario";
import { Button } from "@/components/button";
import { DateTimeField } from "@/components/date-time-field";
import { DayPicker } from "@/components/day-picker";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { FieldError, ListRow, Section } from "@/components/section";
import { TextField } from "@/components/text-field";
import { useHorario } from "@/horario/horario-provider";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

/** Crea o edita un bloque del horario. Si la API lo rechaza, los datos ingresados se conservan. */
export default function BloqueScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useSession();
  const { borrador, actualizarBorrador, elegirPara } = useHorario();
  const datos = {
    diaSemana: borrador.diaSemana,
    inicio: borrador.inicio,
    fin: borrador.fin,
    destinoId: borrador.destino?.id ?? null,
    titulo: borrador.titulo.trim() || null,
  };

  const listo = () => {
    void queryClient.invalidateQueries({ queryKey: ["horario"] });
    router.back();
  };
  const guardar = useMutation({
    mutationFn: () => (borrador.id ? editarBloque(token!, borrador.id, datos) : crearBloque(token!, datos)),
    onSuccess: listo,
  });
  const eliminar = useMutation({ mutationFn: () => eliminarBloque(token!, borrador.id!), onSuccess: listo });
  const { message, fields } = describeError(guardar.error ?? eliminar.error);
  const cambiar = (cambios: Parameters<typeof actualizarBorrador>[0]) => {
    guardar.reset();
    actualizarBorrador(cambios);
  };

  return (
    <FormScreen>
      {message ? <Notice message={message} /> : null}

      <View style={{ gap: spacing.sm }}>
        <DayPicker value={borrador.diaSemana} onChange={(diaSemana) => cambiar({ diaSemana })} />
        <FieldError message={fields.diaSemana} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Section title="Horario" footer="Horas de Santiago.">
          <DateTimeField label="Inicio" icon="arrival" mode="time" value={borrador.inicio} onChange={(inicio) => cambiar({ inicio })} error={Boolean(fields.inicio)} />
          <DateTimeField label="Término" icon="departure" mode="time" value={borrador.fin} onChange={(fin) => cambiar({ fin })} error={Boolean(fields.fin)} />
        </Section>
        <FieldError message={fields.inicio ?? fields.fin} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Section title="Sala o edificio">
          <ListRow
            icon={borrador.destino?.tipo === "edificio" ? "building" : borrador.destino ? "room" : "pin"}
            title={borrador.destino ? borrador.destino.nombre : "Elegir sala o edificio"}
            detail={borrador.destino ? detalleDestino(borrador.destino) : "Busca por código o nombre"}
            tone={borrador.destino ? "default" : "accent"}
            error={Boolean(fields.destinoId)}
            onPress={() => {
              guardar.reset();
              elegirPara("borrador");
              router.push("/horario-destino");
            }}
          />
        </Section>
        <FieldError message={fields.destinoId} />
      </View>

      <TextField label="Curso (opcional)" icon="calendar" value={borrador.titulo} onChangeText={(titulo) => cambiar({ titulo })} maxLength={120} />

      <View style={{ gap: spacing.sm }}>
        <Button title={borrador.id ? "Guardar cambios" : "Agregar al horario"} onPress={() => guardar.mutate()} loading={guardar.isPending} />
        {borrador.id ? (
          <Button
            title="Eliminar bloque"
            variant="destructive"
            loading={eliminar.isPending}
            onPress={() =>
              Alert.alert("¿Eliminar este bloque?", "Tus reservas confirmadas no cambian.", [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: () => eliminar.mutate() },
              ])
            }
          />
        ) : null}
      </View>
    </FormScreen>
  );
}
