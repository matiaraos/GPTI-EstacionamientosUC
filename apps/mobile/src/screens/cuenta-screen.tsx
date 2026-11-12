import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { obtenerCuenta } from "@/api/cuentas";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { colors, radius, spacing } from "@/theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
      <ThemedText variant="footnote">{label}</ThemedText>
      <ThemedText variant="body" selectable>
        {value}
      </ThemedText>
    </View>
  );
}

export default function CuentaScreen() {
  const { token, signOut } = useSession();
  const cuenta = useQuery({
    queryKey: ["cuenta"],
    queryFn: () => obtenerCuenta(token!),
    enabled: Boolean(token),
  });
  const salir = useMutation({ mutationFn: signOut });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      {cuenta.isLoading ? (
        <ActivityIndicator accessibilityLabel="Cargando tu cuenta" style={{ padding: spacing.xl }} />
      ) : cuenta.data ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <Row label="Correo" value={cuenta.data.cuenta.correo} />
          <View style={{ height: 1, backgroundColor: colors.separator }} />
          <Row
            label={cuenta.data.cuenta.vehiculos.length > 1 ? "Patentes" : "Patente"}
            value={cuenta.data.cuenta.vehiculos.map((vehiculo) => vehiculo.patente).join(", ")}
          />
        </View>
      ) : null}

      {cuenta.error ? (
        <View style={{ gap: spacing.md }}>
          <Notice message={describeError(cuenta.error).message ?? "No se pudo cargar tu cuenta."} />
          <Button title="Reintentar" variant="secondary" onPress={() => cuenta.refetch()} loading={cuenta.isFetching} />
        </View>
      ) : null}

      <Button title="Cerrar sesión" variant="destructive" onPress={() => salir.mutate()} loading={salir.isPending} />

      <Link href="/diagnostico" style={{ color: colors.secondaryLabel, fontSize: 15, padding: spacing.sm, textAlign: "center" }}>
        Verificar conexión con el servidor
      </Link>
    </ScrollView>
  );
}
