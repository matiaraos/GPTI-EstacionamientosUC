import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { describeError } from "@/api/errors";
import { obtenerReserva, registrarEntrada, registrarSalida, type ResultadoUso } from "@/api/reservas";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { FormScreen } from "@/components/form-screen";
import { Icon } from "@/components/icon";
import { Notice } from "@/components/notice";
import { Encuesta } from "@/components/encuesta";
import { PlazaBanner } from "@/components/plaza-banner";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { radius, spacing, useTheme } from "@/theme";

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
/** Esquinas del visor sobre la cámara, para indicar dónde encuadrar el QR. */
function Visor({ color }: { color: string }) {
  const largo = 36;
  const grosor = 4;
  const esquina = (pos: object) => (
    <View style={[{ position: "absolute", width: largo, height: largo, borderColor: color }, pos]} />
  );
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: "18%", left: "18%", right: "18%", bottom: "18%" }}>
      {esquina({ top: 0, left: 0, borderTopWidth: grosor, borderLeftWidth: grosor, borderTopLeftRadius: radius.md })}
      {esquina({ top: 0, right: 0, borderTopWidth: grosor, borderRightWidth: grosor, borderTopRightRadius: radius.md })}
      {esquina({ bottom: 0, left: 0, borderBottomWidth: grosor, borderLeftWidth: grosor, borderBottomLeftRadius: radius.md })}
      {esquina({ bottom: 0, right: 0, borderBottomWidth: grosor, borderRightWidth: grosor, borderBottomRightRadius: radius.md })}
    </View>
  );
}

export default function EscanearScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { token } = useSession();
  const params = useLocalSearchParams<{ reserva: string; tipo: "entrada" | "salida" }>();
  const reservaId = Number(params.reserva);
  const esEntrada = params.tipo !== "salida";
  // La plaza se muestra destacada para que la persona sepa qué QR escanear.
  const reserva = useQuery({
    queryKey: ["reservas", reservaId],
    queryFn: () => obtenerReserva(token!, reservaId),
    enabled: Boolean(token) && Number.isFinite(reservaId),
  });
  const plaza = reserva.data?.reserva;
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
      <FormScreen>
        <Stack.Screen options={{ title: titulo }} />
        <EmptyState
          icon="success"
          title={esEntrada ? "Llegada registrada" : "Salida registrada"}
          message={
            esEntrada
              ? `Estás en la plaza ${reserva.plaza.codigo} de ${reserva.zona.nombre}. Recuerda registrar tu salida antes de las ${reserva.salida}.`
              : `La plaza ${reserva.plaza.codigo} quedó libre. ¡Gracias por avisar!`
          }
          action={<Button title="Listo" onPress={() => router.back()} />}
        />
        {esEntrada ? null : <Encuesta reservaId={reserva.id} />}
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Stack.Screen options={{ title: titulo }} />
      {plaza ? (
        <PlazaBanner codigo={plaza.plaza.codigo} bloque={plaza.zona.nombre} instruccion={`Escanea el QR de la plaza ${plaza.plaza.codigo}`} />
      ) : null}

      <View
        style={{
          aspectRatio: 1,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!permiso ? (
          <ActivityIndicator color={colors.accent} />
        ) : permiso.granted ? (
          <>
            <CameraView
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={estado.fase === "escaneando" ? ({ data }) => void enviar(data) : undefined}
            />
            <Visor color={estado.fase === "error" ? colors.danger : "#FFFFFF"} />
          </>
        ) : (
          <View style={{ padding: spacing.lg, gap: spacing.md, alignItems: "center" }}>
            <Icon name="qr" size={40} color={colors.accentText} />
            <ThemedText variant="callout" style={{ textAlign: "center" }}>
              Permite el uso de la cámara para leer el QR de la plaza.
            </ThemedText>
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
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.full,
              backgroundColor: colors.surface,
              flexDirection: "row",
              gap: spacing.sm,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={colors.accent} />
            <ThemedText variant="callout" style={{ fontWeight: "600" }}>
              Registrando…
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText variant="subhead">
        {esEntrada
          ? "Encuadra el código dentro del visor. Usaremos tu ubicación solo para confirmar que estás en el campus; no se guarda."
          : "Encuadra el código dentro del visor para liberar la plaza."}
      </ThemedText>

      {estado.fase === "error" ? (
        <View style={{ gap: spacing.sm }}>
          <Notice message={estado.mensaje} />
          <Button title="Volver a escanear" icon="qr" variant="secondary" onPress={() => setEstado({ fase: "escaneando" })} />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <TextField
          label="¿La cámara no lee el código?"
          icon="qr"
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
    </FormScreen>
  );
}
