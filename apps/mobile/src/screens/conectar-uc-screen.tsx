import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { conectarHorarioUC, estadoHorarioUC } from "@/api/horario";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { radius, spacing, useTheme } from "@/theme";

const PASOS = [
  { icono: "person", texto: "Inicias sesión con tu cuenta UC en la página oficial de la universidad." },
  { icono: "success", texto: "Autorizas a MiEstacionamientoUC a leer tus cursos inscritos y sus salas." },
  { icono: "calendar", texto: "Revisas los bloques propuestos y eliges cuáles guardar." },
] as const;

/**
 * Conexión con el horario UC. La integración real requiere autorización de la universidad, así que
 * esta pantalla la simula: en vez de iniciar sesión, se elige un estudiante de prueba cuya
 * inscripción usa secciones reales de Buscacursos (San Joaquín). No pide la clave UC.
 */
export default function ConectarUCScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { token } = useSession();
  const estado = useQuery({ queryKey: ["horario-uc"], queryFn: () => estadoHorarioUC(token!), enabled: Boolean(token) });
  const conectar = useMutation({
    mutationFn: (perfil: string) => conectarHorarioUC(token!, perfil),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["horario-uc"] });
      router.replace("/sincronizar-uc");
    },
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      <View style={{ alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm }}>
        <View style={{ width: 64, height: 64, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Icon name="calendar" size={32} color={colors.onAccent} />
        </View>
        <ThemedText variant="title" style={{ textAlign: "center" }}>
          Trae tu horario de la UC
        </ThemedText>
        <ThemedText variant="callout" tone="secondary" style={{ textAlign: "center" }}>
          Tus cátedras, ayudantías y laboratorios con su sala, para reservar cerca de tu clase sin escribirlos.
        </ThemedText>
      </View>

      <Section title="Cómo funcionará">
        {PASOS.map((paso, i) => (
          <ListRow key={paso.texto} icon={paso.icono} title={`Paso ${i + 1}`} detail={paso.texto} />
        ))}
      </Section>

      <Notice
        tone="info"
        message="Demostración: la conexión con los sistemas UC aún no está autorizada. Elige un estudiante de prueba; sus cursos son secciones reales de Buscacursos en San Joaquín. Nunca ingreses tu clave UC en esta app."
      />

      {estado.isLoading ? <ActivityIndicator accessibilityLabel="Cargando estudiantes de prueba" color={colors.accent} /> : null}
      {estado.error || conectar.error ? <Notice message={describeError(estado.error ?? conectar.error).message ?? "No se pudo conectar."} /> : null}

      {estado.data ? (
        <Section title="Estudiantes de prueba" footer={estado.data.conexion ? "Elegir otro reemplaza tu inscripción simulada." : undefined}>
          {estado.data.perfiles.map((perfil) => (
            <ListRow
              key={perfil.codigo}
              icon="person"
              title={perfil.nombre}
              detail={`${perfil.carrera} · ${perfil.cursos} cursos`}
              accessibilityHint="Conecta con la inscripción de este estudiante de prueba"
              onPress={() => conectar.mutate(perfil.codigo)}
            />
          ))}
        </Section>
      ) : null}

      {conectar.isPending ? <ActivityIndicator accessibilityLabel="Conectando" color={colors.accent} /> : null}
      <Button title="Ahora no" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
