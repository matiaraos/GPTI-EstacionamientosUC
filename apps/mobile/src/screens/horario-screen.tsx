import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { DIAS, obtenerHorario, type BloqueClase } from "@/api/horario";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { borradorVacio, useHorario } from "@/horario/horario-provider";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

/** Horario semanal guardado en la API (03B): se conserva al reabrir la app o cambiar de teléfono. */
export default function HorarioScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { token } = useSession();
  const { editar, elegirPara } = useHorario();
  const horario = useQuery({ queryKey: ["horario"], queryFn: () => obtenerHorario(token!), enabled: Boolean(token) });
  const bloques = horario.data?.bloques ?? [];

  const abrir = (bloque?: BloqueClase) => {
    elegirPara("borrador");
    editar(
      bloque
        ? { id: bloque.id, diaSemana: bloque.diaSemana, inicio: bloque.inicio, fin: bloque.fin, titulo: bloque.titulo ?? "", destino: bloque.destino }
        : borradorVacio(),
    );
    router.push("/bloque");
  };

  const porDia = DIAS.map((nombre, i) => ({ nombre, bloques: bloques.filter((b) => b.diaSemana === i + 1) })).filter((d) => d.bloques.length > 0);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      <ThemedText variant="callout" tone="secondary">
        Tus clases de la semana. Al reservar usaremos la sala de tu primera clase del día. Cambiar el horario no modifica tus
        reservas confirmadas.
      </ThemedText>

      {horario.isLoading ? <ActivityIndicator accessibilityLabel="Cargando tu horario" color={colors.accent} /> : null}
      {horario.error ? (
        <View style={{ gap: spacing.md }}>
          <Notice message={describeError(horario.error).message ?? "No se pudo cargar tu horario."} />
          <Button title="Reintentar" variant="secondary" onPress={() => horario.refetch()} />
        </View>
      ) : null}

      {horario.data && bloques.length === 0 ? (
        <EmptyState icon="calendar" title="Sin clases registradas" message="Agrega tus bloques uno a uno o importa tu calendario .ics." />
      ) : null}

      {porDia.map((dia) => (
        <Section key={dia.nombre} title={dia.nombre}>
          {dia.bloques.map((b) => (
            <ListRow
              key={b.id}
              icon={b.destino.tipo === "edificio" ? "building" : "room"}
              title={`${b.inicio}–${b.fin}${b.titulo ? ` · ${b.titulo}` : ""}`}
              detail={`${b.destino.nombre} · ${detalleDestino(b.destino)}`}
              accessibilityHint="Edita el bloque"
              onPress={() => abrir(b)}
            />
          ))}
        </Section>
      ))}

      <View style={{ gap: spacing.sm }}>
        <Button title="Agregar bloque" icon="calendar" onPress={() => abrir()} />
        <Button title="Importar archivo .ics" variant="secondary" icon="import" onPress={() => router.push("/importar-horario")} />
      </View>
    </ScrollView>
  );
}
