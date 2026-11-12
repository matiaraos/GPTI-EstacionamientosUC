import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { estadoHorarioUC, modificarInscripcion, type CambioInscripcion } from "@/api/horario";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ListRow } from "@/components/section";
import { SeccionUCCard } from "@/components/seccion-uc";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

/**
 * Inscripción simulada del semestre. Imita el período de modificación de horario: agregar un curso,
 * quitarlo o cambiarse de sección. Los cambios llegan al horario al sincronizar.
 */
export default function InscripcionUCScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { token } = useSession();
  const estado = useQuery({ queryKey: ["horario-uc"], queryFn: () => estadoHorarioUC(token!), enabled: Boolean(token) });
  const modificar = useMutation({
    mutationFn: (cambio: CambioInscripcion) => modificarInscripcion(token!, cambio),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["horario-uc"] }),
  });
  const conexion = estado.data?.conexion;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      {estado.isLoading ? <ActivityIndicator accessibilityLabel="Cargando inscripción" color={colors.accent} /> : null}
      {estado.error || modificar.error ? <Notice message={describeError(estado.error ?? modificar.error).message ?? "No se pudo actualizar."} /> : null}

      {conexion ? (
        <>
          <ThemedText variant="callout" tone="secondary">
            {conexion.perfil.nombre} · {conexion.perfil.carrera}. {conexion.inscripcion.length} cursos, {conexion.creditos} créditos en{" "}
            {conexion.semestre}. Como en la modificación de horario UC, puedes cambiarte de sección, agregar o quitar cursos.
          </ThemedText>
          {conexion.inscripcion.length === 0 ? (
            <EmptyState icon="calendar" title="Sin cursos inscritos" message="Agrega un curso para armar tu horario." />
          ) : null}
          {conexion.inscripcion.map((seccion) => (
            <SeccionUCCard key={seccion.nrc} seccion={seccion}>
              <ListRow
                icon="clock"
                title="Cambiar sección"
                tone="accent"
                onPress={() => router.push({ pathname: "/secciones-uc", params: { q: seccion.sigla, cambiar: seccion.nrc } })}
              />
              <ListRow
                icon="cancel"
                title="Quitar curso"
                tone="danger"
                onPress={() =>
                  Alert.alert(`¿Quitar ${seccion.sigla}?`, "Sus bloques saldrán de tu horario al sincronizar.", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Quitar", style: "destructive", onPress: () => modificar.mutate({ accion: "quitar", nrc: seccion.nrc }) },
                  ])
                }
              />
            </SeccionUCCard>
          ))}
          <View style={{ gap: spacing.sm }}>
            <Button title="Revisar y sincronizar horario" icon="calendar" onPress={() => router.push("/sincronizar-uc")} />
            <Button title="Agregar curso" variant="secondary" icon="search" onPress={() => router.push("/secciones-uc")} />
          </View>
        </>
      ) : estado.data ? (
        <EmptyState
          icon="calendar"
          title="Sin conexión"
          message="Conecta tu horario UC para ver tu inscripción."
          action={<Button title="Conectar" onPress={() => router.replace("/conectar-uc")} />}
        />
      ) : null}
    </ScrollView>
  );
}
