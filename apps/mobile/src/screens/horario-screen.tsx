import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { DIAS, desconectarHorarioUC, estadoHorarioUC, etiquetaModulos, obtenerHorario, type BloqueClase } from "@/api/horario";
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
  const uc = useQuery({ queryKey: ["horario-uc"], queryFn: () => estadoHorarioUC(token!), enabled: Boolean(token) });
  const conexion = uc.data?.conexion;
  const queryClient = useQueryClient();
  const desconectar = useMutation({
    mutationFn: (bloques: "quitar" | "conservar") => desconectarHorarioUC(token!, bloques),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["horario"] });
      void queryClient.invalidateQueries({ queryKey: ["horario-uc"] });
    },
  });
  const bloques = horario.data?.bloques ?? [];

  const abrir = (bloque?: BloqueClase) => {
    elegirPara("borrador");
    editar(
      bloque
        ? { id: bloque.id, diaSemana: bloque.diaSemana, inicio: bloque.inicio, fin: bloque.fin, titulo: bloque.titulo ?? "", destino: bloque.destino, uc: bloque.origen === "uc" }
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
        Tus clases de la semana. Al reservar usaremos la sala de tu primera clase durante la visita y la de la última para
        desempatar. Cambiar el horario no modifica tus reservas confirmadas.
      </ThemedText>

      {conexion ? (
        <Section
          title={`Horario UC · ${conexion.semestre ?? ""}`}
          footer={
            conexion.sincronizadaEn
              ? `Sincronizado el ${new Date(conexion.sincronizadaEn).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}. Demostración con un estudiante de prueba.`
              : "Aún no sincronizas: revisa los bloques propuestos y guárdalos."
          }
        >
          <ListRow icon="person" title={conexion.perfil.nombre} detail={conexion.perfil.carrera} />
          <ListRow
            icon="calendar"
            title="Mi inscripción"
            detail={`${conexion.inscripcion.length} cursos · ${conexion.creditos} créditos · cambiar sección, agregar o quitar`}
            onPress={() => router.push("/inscripcion-uc")}
          />
          <ListRow icon="sync" title={conexion.sincronizadaEn ? "Sincronizar" : "Revisar y sincronizar"} tone="accent" onPress={() => router.push("/sincronizar-uc")} />
          <ListRow
            icon="logout"
            title="Desconectar"
            tone="danger"
            onPress={() =>
              Alert.alert("¿Desconectar tu horario UC?", "Puedes conservar los bloques como propios o quitarlos.", [
                { text: "Cancelar", style: "cancel" },
                { text: "Conservar bloques", onPress: () => desconectar.mutate("conservar") },
                { text: "Quitar bloques", style: "destructive", onPress: () => desconectar.mutate("quitar") },
              ])
            }
          />
        </Section>
      ) : uc.data ? (
        <Section title="Horario UC" footer="Demostración: la conexión real con la UC requiere autorización.">
          <ListRow
            icon="calendar"
            title="Conectar con mi horario UC"
            detail="Trae tus cursos inscritos con su sala y módulo"
            tone="accent"
            onPress={() => router.push("/conectar-uc")}
          />
        </Section>
      ) : null}

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
              title={`${b.inicio}–${b.fin}${etiquetaModulos(b.inicio, b.fin) ? ` · ${etiquetaModulos(b.inicio, b.fin)}` : ""}`}
              detail={[
                b.curso ? `${b.curso.sigla}-${b.curso.seccion} ${b.curso.nombre} · ${b.titulo?.split(" · ").at(-1) ?? b.curso.tipo}` : b.titulo,
                `${b.destino.nombre} · ${detalleDestino(b.destino)}${b.origen === "uc" ? " · UC" : b.origen === "ics" ? " · .ics" : ""}`,
              ]
                .filter(Boolean)
                .join("\n")}
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
