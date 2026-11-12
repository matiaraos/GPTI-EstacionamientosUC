import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { detalleDestino } from "@/api/catalogo";
import { ApiError } from "@/api/client";
import { describeError } from "@/api/errors";
import { DIAS, obtenerHorario, previsualizarIcs, reemplazarHorario, type DatosBloque } from "@/api/horario";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { useHorario } from "@/horario/horario-provider";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

/**
 * Importa un calendario `.ics`: la API propone los bloques y marca los que requieren corrección; la
 * persona elige el destino de los dudosos y confirma. Hasta confirmar, el horario guardado no cambia.
 */
export default function ImportarHorarioScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { token } = useSession();
  const { importados, fijarImportados, elegirPara } = useHorario();
  const [omitidos, setOmitidos] = useState<string[]>([]);

  const leer = useMutation({
    mutationFn: async () => {
      const resultado = await DocumentPicker.getDocumentAsync({ type: ["text/calendar", "application/ics", "*/*"], copyToCacheDirectory: true });
      if (resultado.canceled) return null;
      const archivo = resultado.assets[0];
      let contenido: string;
      try {
        contenido = await new File(archivo.uri).text();
      } catch {
        throw new ApiError(0, "archivo_ilegible", "No pudimos abrir el archivo. Elige un calendario .ics.");
      }
      return previsualizarIcs(token!, contenido);
    },
    onSuccess: (vista) => {
      if (!vista) return;
      fijarImportados(vista.bloques);
      setOmitidos(vista.omitidos);
    },
  });

  const pendientes = (importados ?? []).filter((b) => !b.destino || b.problemas.length > 0).length;

  const guardar = useMutation({
    mutationFn: async (modo: "agregar" | "reemplazar") => {
      const nuevos: DatosBloque[] = (importados ?? []).map((b) => ({
        diaSemana: b.diaSemana,
        inicio: b.inicio,
        fin: b.fin,
        titulo: b.titulo,
        destinoId: b.destino?.id ?? null,
        origen: "ics" as const,
      }));
      const actuales =
        modo === "agregar"
          ? (await obtenerHorario(token!)).bloques
              // Los bloques del horario UC se conservan aparte; aquí solo se reenvían los propios.
              .filter((b) => b.origen !== "uc")
              .map((b) => ({ diaSemana: b.diaSemana, inicio: b.inicio, fin: b.fin, titulo: b.titulo, destinoId: b.destino.id, origen: b.origen as "manual" | "ics" }))
          : [];
      return reemplazarHorario(token!, [...actuales, ...nuevos]);
    },
    onSuccess: () => {
      fijarImportados(null);
      void queryClient.invalidateQueries({ queryKey: ["horario"] });
      router.back();
    },
  });
  const error = describeError(leer.error ?? guardar.error);
  const confirmar = () =>
    Alert.alert("¿Cómo guardar los bloques?", "Los bloques de tu horario UC y tus reservas confirmadas no cambian.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Agregar a mi horario", onPress: () => guardar.mutate("agregar") },
      { text: "Reemplazar mis bloques", style: "destructive", onPress: () => guardar.mutate("reemplazar") },
    ]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      {error.message ? <Notice message={Object.keys(error.fields).length ? "Hay bloques con problemas. Revísalos y vuelve a guardar; tu horario no cambió." : error.message} /> : null}

      {!importados ? (
        <EmptyState
          icon="import"
          title="Importa tu calendario"
          message="Exporta tu horario como archivo .ics desde tu calendario y elígelo aquí. Podrás revisar cada bloque antes de guardar."
          action={<Button title="Elegir archivo .ics" icon="import" onPress={() => leer.mutate()} loading={leer.isPending} />}
        />
      ) : (
        <>
          <Notice
            tone={pendientes > 0 ? "info" : "success"}
            message={
              pendientes > 0
                ? `${importados.length} bloques encontrados. ${pendientes} requieren que elijas la sala o el edificio.`
                : `${importados.length} bloques listos para guardar.`
            }
          />
          {DIAS.map((nombre, i) => {
            const delDia = importados.map((b, indice) => ({ b, indice })).filter(({ b }) => b.diaSemana === i + 1);
            if (delDia.length === 0) return null;
            return (
              <Section key={nombre} title={nombre}>
                {delDia.map(({ b, indice }) => (
                  <ListRow
                    key={indice}
                    icon={b.destino ? (b.destino.tipo === "edificio" ? "building" : "room") : "error"}
                    title={`${b.inicio}–${b.fin}${b.titulo ? ` · ${b.titulo}` : ""}`}
                    detail={
                      b.destino
                        ? `${b.destino.nombre} · ${detalleDestino(b.destino)}${b.problemas.length ? `\n${b.problemas.join(" ")}` : ""}`
                        : b.problemas.join(" ")
                    }
                    tone={b.destino ? "default" : "danger"}
                    error={b.problemas.length > 0 || Boolean(error.fields[`bloques.${indice}.inicio`] ?? error.fields[`bloques.${indice}.destinoId`])}
                    accessibilityHint="Elige la sala o el edificio"
                    onPress={() => {
                      elegirPara(indice);
                      router.push({ pathname: "/horario-destino", params: { q: b.ubicacion ?? "" } });
                    }}
                  />
                ))}
              </Section>
            );
          })}
          {omitidos.length > 0 ? (
            <Section title="No importados" footer="Estos eventos no tienen un horario semanal que se pueda guardar.">
              {omitidos.map((texto) => (
                <ListRow key={texto} icon="info" title={texto} />
              ))}
            </Section>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            <Button title="Guardar bloques" onPress={confirmar} disabled={pendientes > 0} loading={guardar.isPending} />
            <Button
              title="Elegir otro archivo"
              variant="ghost"
              onPress={() => {
                fijarImportados(null);
                leer.mutate();
              }}
            />
          </View>
          {pendientes > 0 ? (
            <ThemedText variant="footnote" style={{ textAlign: "center" }}>
              Toca cada bloque marcado para elegir su destino.
            </ThemedText>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
