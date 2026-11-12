import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { obtenerCuenta } from "@/api/cuentas";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { ListRow, Section } from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { radius, spacing, useTheme } from "@/theme";

export default function CuentaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { token, signOut } = useSession();
  const cuenta = useQuery({
    queryKey: ["cuenta"],
    queryFn: () => obtenerCuenta(token!),
    enabled: Boolean(token),
  });
  const salir = useMutation({ mutationFn: signOut });
  const datos = cuenta.data?.cuenta;

  const confirmarSalida = () =>
    Alert.alert("¿Cerrar sesión?", "Tendrás que volver a ingresar tu correo y contraseña.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => salir.mutate() },
    ]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      {cuenta.isLoading ? <ActivityIndicator accessibilityLabel="Cargando tu cuenta" color={colors.accent} style={{ padding: spacing.xl }} /> : null}

      {cuenta.error ? (
        <View style={{ gap: spacing.md }}>
          <Notice message={describeError(cuenta.error).message ?? "No se pudo cargar tu cuenta."} />
          <Button title="Reintentar" variant="secondary" onPress={() => cuenta.refetch()} loading={cuenta.isFetching} />
        </View>
      ) : null}

      {datos ? (
        <>
          <View style={{ alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm }} accessible accessibilityLabel={`Cuenta de ${datos.correo}`}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.full,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText variant="largeTitle" tone="onAccent">
                {datos.correo.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText variant="headline" selectable>
              {datos.correo}
            </ThemedText>
            <ThemedText variant="footnote">{datos.rol === "admin" ? "Administración" : "Comunidad UC"}</ThemedText>
          </View>

          <Section title="Mis datos">
            <ListRow icon="mail" title="Correo" value={datos.correo} stacked />
            <ListRow
              icon="car"
              title={datos.vehiculos.length > 1 ? "Patentes" : "Patente"}
              value={datos.vehiculos.map((vehiculo) => vehiculo.patente).join(", ")}
            />
          </Section>
        </>
      ) : null}

      <Section title="Ayuda">
        <ListRow icon="wifi" title="Verificar conexión" detail="Comprueba que la app llega al servidor" onPress={() => router.push("/diagnostico")} />
      </Section>

      <Section>
        <ListRow icon="logout" title={salir.isPending ? "Cerrando sesión…" : "Cerrar sesión"} tone="danger" onPress={confirmarSalida} />
      </Section>
    </ScrollView>
  );
}
