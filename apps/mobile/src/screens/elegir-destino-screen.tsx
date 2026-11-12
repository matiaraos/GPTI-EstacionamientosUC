import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { buscarDestinos, detalleDestino, type Destino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSolicitud } from "@/reserva/solicitud-provider";
import { useSession } from "@/session/session-provider";
import { minTouch, radius, spacing, useTheme } from "@/theme";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Busca una sala o un edificio por código o nombre y lo deja en la solicitud. */
export default function ElegirDestinoScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { token } = useSession();
  const { actualizar } = useSolicitud();
  const [texto, setTexto] = useState("");
  const q = useDebounced(texto.trim(), 250);

  const resultados = useQuery({
    queryKey: ["destinos", q],
    queryFn: () => buscarDestinos(token!, q),
    enabled: Boolean(token) && q.length > 0,
    placeholderData: (anterior) => anterior,
  });

  const elegir = (destino: Destino) => {
    actualizar({ destino });
    router.back();
  };

  const destinos = q.length > 0 ? (resultados.data?.destinos ?? []) : [];

  let vacio: React.ReactNode;
  if (q.length === 0) {
    vacio = <EmptyState icon="search" title="Busca tu destino" message="Escribe el código de la sala (por ejemplo, ED113) o el nombre del edificio." />;
  } else if (resultados.isLoading) {
    vacio = <ActivityIndicator accessibilityLabel="Buscando" color={colors.accent} style={{ padding: spacing.xl }} />;
  } else if (resultados.error) {
    vacio = (
      <View style={{ gap: spacing.md }}>
        <Notice message={describeError(resultados.error).message ?? "No se pudo buscar."} />
        <Button title="Reintentar" variant="secondary" onPress={() => resultados.refetch()} />
      </View>
    );
  } else {
    vacio = <EmptyState icon="search" title="Sin resultados" message={`No encontramos «${q}». Prueba con otro código o nombre.`} />;
  }

  return (
    <FlatList
      data={destinos}
      keyExtractor={(destino) => String(destino.id)}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
      ListHeaderComponent={
        <View style={{ paddingBottom: spacing.md }}>
          <TextField
            label="Sala o edificio"
            icon="search"
            placeholder="ED113, Centro de Innovación…"
            value={texto}
            onChangeText={setTexto}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      }
      ListEmptyComponent={vacio}
      renderItem={({ item, index }) => {
        const primero = index === 0;
        const ultimo = index === destinos.length - 1;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.nombre}, ${detalleDestino(item)}`}
            onPress={() => elegir(item)}
            style={({ pressed }) => ({
              minHeight: minTouch + 16,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderTopLeftRadius: primero ? radius.lg : 0,
              borderTopRightRadius: primero ? radius.lg : 0,
              borderBottomLeftRadius: ultimo ? radius.lg : 0,
              borderBottomRightRadius: ultimo ? radius.lg : 0,
              borderBottomWidth: ultimo ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: colors.separator,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.sm + 2,
                backgroundColor: colors.accentSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={item.tipo === "edificio" ? "building" : "room"} color={colors.accentText} />
            </View>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <ThemedText variant="body" style={{ fontWeight: "600" }}>
                {item.nombre}
              </ThemedText>
              <ThemedText variant="footnote">{detalleDestino(item)}</ThemedText>
            </View>
            <Icon name="chevron" size={18} color={colors.tertiaryLabel} />
          </Pressable>
        );
      }}
    />
  );
}
