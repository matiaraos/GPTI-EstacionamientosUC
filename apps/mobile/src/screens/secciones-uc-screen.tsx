import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { buscarSeccionesUC, modificarInscripcion, type SeccionUC } from "@/api/horario";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ListRow } from "@/components/section";
import { SeccionUCCard } from "@/components/seccion-uc";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

/** Busca secciones por sigla o nombre (como Buscacursos) para agregarlas o cambiarse de sección. */
export default function SeccionesUCScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { token } = useSession();
  const params = useLocalSearchParams<{ q?: string; cambiar?: string }>();
  const [texto, setTexto] = useState(params.q ?? "");
  const [q, setQ] = useState(texto.trim());
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const secciones = useQuery({
    queryKey: ["secciones-uc", q],
    queryFn: () => buscarSeccionesUC(token!, q),
    enabled: Boolean(token) && q.length >= 2,
    placeholderData: (anterior) => anterior,
  });
  const elegir = useMutation({
    mutationFn: (seccion: SeccionUC) =>
      modificarInscripcion(token!, params.cambiar ? { accion: "cambiar", nrc: params.cambiar, por: seccion.nrc } : { accion: "agregar", nrc: seccion.nrc }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["horario-uc"] });
      router.back();
    },
  });
  const lista = (q.length >= 2 ? secciones.data?.secciones : []) ?? [];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg }}
    >
      <TextField
        label="Sigla o nombre del curso"
        icon="search"
        placeholder="MAT1610, Cálculo…"
        value={texto}
        onChangeText={setTexto}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={!params.q}
      />
      {params.cambiar ? <Notice tone="info" message="Elige la sección a la que te cambias. La actual se reemplaza en tu inscripción." /> : null}
      {elegir.error ? <Notice message={describeError(elegir.error).message ?? "No se pudo modificar la inscripción."} /> : null}
      {secciones.isFetching && !secciones.data ? <ActivityIndicator accessibilityLabel="Buscando" color={colors.accent} /> : null}
      {q.length >= 2 && secciones.data && lista.length === 0 ? (
        <EmptyState icon="search" title="Sin resultados" message={`No hay secciones de «${q}» en San Joaquín este semestre.`} />
      ) : null}
      {lista.map((seccion) => {
        const actual = seccion.nrc === params.cambiar;
        return (
          <View key={seccion.nrc}>
            <SeccionUCCard seccion={seccion}>
              <ListRow
                icon={actual ? "success" : "calendar"}
                title={actual ? "Tu sección actual" : params.cambiar ? "Cambiarme a esta sección" : "Agregar a mi inscripción"}
                tone={actual ? "default" : "accent"}
                onPress={actual || elegir.isPending ? undefined : () => elegir.mutate(seccion)}
              />
            </SeccionUCCard>
          </View>
        );
      })}
    </ScrollView>
  );
}
