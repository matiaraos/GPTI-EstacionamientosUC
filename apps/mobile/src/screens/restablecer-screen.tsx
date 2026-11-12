import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { type TextInput, View } from "react-native";
import { confirmarRecuperacion, tokenDeEnlace } from "@/api/cuentas";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

/**
 * Se abre desde el enlace del correo (`miestacionamientouc://restablecer?token=…`). Si el enlace no
 * abre la app, se puede pegar aquí.
 */
export default function RestablecerScreen() {
  const router = useRouter();
  const { status, signOut } = useSession();
  const params = useLocalSearchParams<{ token?: string }>();
  const desdeEnlace = Boolean(params.token);
  const [enlace, setEnlace] = useState(params.token ?? "");
  const [contrasena, setContrasena] = useState("");
  const contrasenaRef = useRef<TextInput>(null);

  const cambio = useMutation({
    mutationFn: () => confirmarRecuperacion(tokenDeEnlace(enlace), contrasena),
    // La API cierra todas las sesiones de la cuenta; si había una abierta en este teléfono, se olvida.
    onSuccess: () => (status === "signedIn" ? signOut() : undefined),
  });
  const { message, fields } = describeError(cambio.error);
  const submit = () => {
    if (!cambio.isPending && !cambio.isSuccess) cambio.mutate();
  };

  if (cambio.data) {
    return (
      <FormScreen>
        <Notice tone="success" message={cambio.data.mensaje} />
        <Button title="Ir a iniciar sesión" onPress={() => router.dismissTo("/iniciar-sesion")} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <ThemedText variant="callout" tone="secondary">
        Elige una contraseña de al menos 8 caracteres. Al guardarla se cerrarán las sesiones abiertas de tu cuenta.
      </ThemedText>

      {message ? <Notice message={message} /> : null}

      <View style={{ gap: spacing.md }}>
        {desdeEnlace ? null : (
          <TextField
            label="Enlace del correo"
            icon="link"
            hint="Pega el enlace completo que recibiste."
            value={enlace}
            onChangeText={setEnlace}
            error={fields.token}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => contrasenaRef.current?.focus()}
          />
        )}
        <TextField
          ref={contrasenaRef}
          label="Nueva contraseña"
          icon="key"
          value={contrasena}
          onChangeText={setContrasena}
          error={fields.contrasena ?? (desdeEnlace ? fields.token : undefined)}
          secureTextEntry
          revelable
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title="Guardar contraseña" onPress={submit} loading={cambio.isPending} />
        {cambio.error && status !== "signedIn" ? (
          <Button title="Solicitar otro enlace" variant="ghost" onPress={() => router.replace("/recuperar")} />
        ) : null}
      </View>
    </FormScreen>
  );
}
