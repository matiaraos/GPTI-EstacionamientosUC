import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, ScrollView, Switch, View } from "react-native";
import { ApiError } from "@/api/client";
import { describeError } from "@/api/errors";
import { DIAS, sincronizarHorarioUC, vistaPreviaUC, type BloqueUCPropuesto } from "@/api/horario";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { useHorario } from "@/horario/horario-provider";
import { useSession } from "@/session/session-provider";
import { spacing, useTheme } from "@/theme";

const CAMBIO: Record<BloqueUCPropuesto["cambio"], string> = { nuevo: "Nuevo", modificado: "Cambió", sin_cambios: "Sin cambios" };

/**
 * Revisión antes de sincronizar: cada bloque de la inscripción con su módulo, tipo y sala, si es nuevo
 * o cambió, y los que saldrán del horario. Los bloques sin sala o con tope quedan fuera hasta que la
 * persona elija destino o los active. Hasta guardar, el horario no cambia.
 */
export default function SincronizarUCScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { token } = useSession();
  const { vistaUC, fijarVistaUC, actualizarBloqueUC, elegirPara } = useHorario();
  const vista = useQuery({ queryKey: ["horario-uc", "vista-previa"], queryFn: () => vistaPreviaUC(token!), enabled: Boolean(token), gcTime: 0 });
  useEffect(() => {
    if (vista.data) fijarVistaUC(vista.data.bloques);
  }, [vista.data, fijarVistaUC]);

  const bloques = vistaUC ?? [];
  const incluidos = bloques.filter((b) => b.incluir);
  const sinDestino = incluidos.filter((b) => !b.destino).length;

  const guardar = useMutation({
    mutationFn: () =>
      sincronizarHorarioUC(
        token!,
        incluidos.map((b) => ({ actividadUCId: b.actividadUCId, diaSemana: b.diaSemana, inicio: b.inicio, fin: b.fin, destinoId: b.destino?.id ?? null })),
      ),
    onSuccess: () => {
      fijarVistaUC(null);
      void queryClient.invalidateQueries({ queryKey: ["horario"] });
      void queryClient.invalidateQueries({ queryKey: ["horario-uc"] });
      router.dismissTo("/horario");
    },
  });
  const error = describeError(vista.error ?? guardar.error);
  const conCampos = guardar.error instanceof ApiError && Object.keys(guardar.error.details).length > 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      {vista.isLoading ? <ActivityIndicator accessibilityLabel="Preparando tu horario" color={colors.accent} /> : null}
      {error.message ? (
        <Notice message={conCampos ? "Hay bloques que se superponen o sin destino. Revísalos; tu horario no cambió." : error.message} />
      ) : null}

      {vista.data && bloques.length === 0 ? (
        <EmptyState icon="calendar" title="Sin bloques" message="Tu inscripción no tiene actividades con horario en San Joaquín." />
      ) : null}

      {bloques.length > 0 ? (
        <Notice
          tone={sinDestino > 0 ? "error" : "info"}
          message={
            sinDestino > 0
              ? `${sinDestino} bloques activados no tienen destino. Tócalos para elegir la sala.`
              : `Se guardarán ${incluidos.length} de ${bloques.length} bloques. Los que quedan fuera no se usarán para reservar.`
          }
        />
      ) : null}

      {DIAS.map((dia, d) => {
        const delDia = bloques.map((b, indice) => ({ b, indice })).filter(({ b }) => b.diaSemana === d + 1);
        if (delDia.length === 0) return null;
        return (
          <Section key={dia} title={dia}>
            {delDia.map(({ b, indice }) => (
              <ListRow
                key={b.clave}
                icon={b.destino ? (b.destino.tipo === "edificio" ? "building" : "room") : "error"}
                tone={b.incluir && !b.destino ? "danger" : "default"}
                title={`${b.inicio}–${b.fin} · ${b.sigla} ${b.tipoNombre}`}
                detail={[
                  `${b.modulosTexto} · M${b.modulos.join("–")} · ${b.destino ? b.destino.nombre : (b.sala ?? "Sin sala")} · ${CAMBIO[b.cambio]}`,
                  ...b.problemas,
                ].join("\n")}
                error={b.incluir && (!b.destino || Boolean(error.fields[`bloques.${incluidos.indexOf(b)}.inicio`]))}
                chevron={false}
                accessibilityHint="Toca para elegir la sala; usa el interruptor para incluirlo"
                onPress={() => {
                  elegirPara({ uc: indice });
                  router.push({ pathname: "/horario-destino", params: { q: b.sala ?? "" } });
                }}
                accessory={
                  <Switch
                    value={b.incluir}
                    onValueChange={(incluir) => actualizarBloqueUC(indice, { incluir })}
                    trackColor={{ true: colors.accent, false: colors.surfaceMuted }}
                    accessibilityLabel={`Incluir ${b.sigla} ${b.tipoNombre} del ${dia.toLowerCase()}`}
                  />
                }
              />
            ))}
          </Section>
        );
      })}

      {vista.data && vista.data.eliminados.length > 0 ? (
        <Section title="Saldrán de tu horario" footer="Ya no están en tu inscripción. Tus reservas confirmadas no cambian.">
          {vista.data.eliminados.map((e) => (
            <ListRow key={e.id} icon="cancel" tone="danger" title={`${DIAS[e.diaSemana - 1]} ${e.inicio}–${e.fin}`} detail={e.titulo ?? e.destino.nombre} />
          ))}
        </Section>
      ) : null}

      {bloques.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Button title={`Guardar ${incluidos.length} bloques`} onPress={() => guardar.mutate()} disabled={sinDestino > 0} loading={guardar.isPending} />
          <ThemedText variant="footnote" style={{ textAlign: "center" }}>
            Tus bloques agregados a mano o importados no cambian.
          </ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}
