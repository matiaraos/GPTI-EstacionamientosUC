import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { buscarDestinos, detalleDestino, type Destino } from "@/api/catalogo";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSolicitud } from "@/reserva/solicitud-provider";
import { useSession } from "@/session/session-provider";
import { colors, minTouch, spacing } from "@/theme";

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

  let vacio: React.ReactNode = null;
  if (q.length === 0) {
    vacio = <ThemedText variant="subhead">Escribe el código de la sala (por ejemplo, ED113) o el nombre del edificio.</ThemedText>;
  } else if (resultados.isLoading) {
    vacio = <ActivityIndicator accessibilityLabel="Buscando" style={{ padding: spacing.lg }} />;
  } else if (resultados.error) {
    vacio = (
      <View style={{ gap: spacing.md }}>
        <Notice message={describeError(resultados.error).message ?? "No se pudo buscar."} />
        <Button title="Reintentar" variant="secondary" onPress={() => resultados.refetch()} />
      </View>
    );
  } else {
    vacio = <ThemedText variant="subhead">No encontramos «{q}». Prueba con otro código o nombre.</ThemedText>;
  }

  return (
    <FlatList
      data={destinos}
      keyExtractor={(destino) => String(destino.id)}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
      ListHeaderComponent={
        <View style={{ paddingBottom: spacing.md }}>
          <TextField
            label="Sala o edificio"
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
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.separator }} />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.nombre}, ${detalleDestino(item)}`}
          onPress={() => elegir(item)}
          style={({ pressed }) => ({
            minHeight: minTouch + 8,
            paddingVertical: spacing.sm,
            justifyContent: "center",
            gap: 2,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ThemedText variant="body">{item.nombre}</ThemedText>
          <ThemedText variant="footnote">{detalleDestino(item)}</ThemedText>
        </Pressable>
      )}
    />
  );
}
