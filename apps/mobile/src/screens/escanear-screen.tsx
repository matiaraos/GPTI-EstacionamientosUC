import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, View } from "react-native";
import { describeError } from "@/api/errors";
import { registrarEntrada, registrarSalida, type ResultadoUso } from "@/api/reservas";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { colors, radius, spacing } from "@/theme";

type Estado = { fase: "escaneando" } | { fase: "enviando" } | { fase: "error"; mensaje: string } | { fase: "listo"; resultado: ResultadoUso };

async function ubicacionActual(): Promise<{ latitud: number; longitud: number }> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (!permiso.granted) {
    throw new Error("Necesitamos tu ubicación para confirmar que estás en el campus. Actívala en los ajustes e inténtalo de nuevo.");
  }
  try {
    const posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
  } catch {
    throw new Error("No pudimos obtener tu ubicación. Revisa que el GPS esté activado e inténtalo de nuevo.");
  }
}

/** Lee el QR de la plaza para registrar la llegada (con ubicación) o la salida. */
export default function EscanearScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useSession();
  const params = useLocalSearchParams<{ reserva: string; tipo: "entrada" | "salida" }>();
  const reservaId = Number(params.reserva);
  const esEntrada = params.tipo !== "salida";
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ fase: "escaneando" });
  const [codigo, setCodigo] = useState("");
  // La cámara puede entregar varias lecturas seguidas del mismo código: solo se procesa la primera.
  const procesando = useRef(false);

  async function enviar(qr: string) {
    if (procesando.current) return;
    procesando.current = true;
    setEstado({ fase: "enviando" });
    try {
      const resultado = esEntrada
        ? await registrarEntrada(token!, reservaId, { qr, ...(await ubicacionActual()) })
        : await registrarSalida(token!, reservaId, qr);
      await queryClient.invalidateQueries({ queryKey: ["reservas"] });
      setEstado({ fase: "listo", resultado });
    } catch (error) {
      const mensaje =
        error instanceof Error && !("code" in error)
          ? error.message
          : (describeError(error).message ?? "No se pudo registrar. Inténtalo de nuevo.");
      setEstado({ fase: "error", mensaje });
    } finally {
      procesando.current = false;
    }
  }

  const titulo = esEntrada ? "Registrar llegada" : "Registrar salida";

  if (estado.fase === "listo") {
    const { reserva } = estado.resultado;
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
        <Stack.Screen options={{ title: titulo }} />
        <Notice
          tone="info"
          message={
            esEntrada
              ? `Llegada registrada en la plaza ${reserva.plaza.codigo}. Recuerda registrar tu salida antes de las ${reserva.salida}.`
              : `Salida registrada. La plaza ${reserva.plaza.codigo} quedó libre. ¡Gracias!`
          }
        />
        <Button title="Listo" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      <Stack.Screen options={{ title: titulo }} />
      <ThemedText variant="subhead">
        Apunta la cámara al código QR de tu plaza.{esEntrada ? " También usaremos tu ubicación para confirmar que estás en el campus." : ""}
      </ThemedText>

      <View
        style={{
          aspectRatio: 1,
          borderRadius: radius.lg,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: colors.field,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!permiso ? (
          <ActivityIndicator />
        ) : permiso.granted ? (
          <CameraView
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={estado.fase === "escaneando" ? ({ data }) => void enviar(data) : undefined}
          />
        ) : (
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <ThemedText variant="callout">Permite el uso de la cámara para leer el QR de la plaza.</ThemedText>
            <Button
              title={permiso.canAskAgain ? "Permitir cámara" : "Abrir ajustes"}
              variant="secondary"
              onPress={() => (permiso.canAskAgain ? pedirPermiso() : Linking.openSettings())}
            />
          </View>
        )}
        {estado.fase === "enviando" ? (
          <View
            style={{
              position: "absolute",
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              flexDirection: "row",
              gap: spacing.sm,
              alignItems: "center",
            }}
          >
            <ActivityIndicator />
            <ThemedText variant="callout">Registrando…</ThemedText>
          </View>
        ) : null}
      </View>

      {estado.fase === "error" ? (
        <View style={{ gap: spacing.sm }}>
          <Notice message={estado.mensaje} />
          <Button title="Volver a escanear" variant="secondary" onPress={() => setEstado({ fase: "escaneando" })} />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <TextField
          label="¿La cámara no lee el código?"
          hint="Escribe el código impreso bajo el QR, por ejemplo MEUC:AbC123…"
          value={codigo}
          onChangeText={setCodigo}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => codigo.trim() && enviar(codigo.trim())}
        />
        <Button
          title="Usar código"
          variant="secondary"
          disabled={!codigo.trim() || estado.fase === "enviando"}
          onPress={() => enviar(codigo.trim())}
        />
      </View>
    </ScrollView>
  );
}
