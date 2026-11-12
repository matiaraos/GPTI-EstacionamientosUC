import { useMutation } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useRef, useState } from "react";
import { type TextInput, View } from "react-native";
import { iniciarSesion } from "@/api/cuentas";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { colors, spacing } from "@/theme";

export default function IniciarSesionScreen() {
  const { signIn } = useSession();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const contrasenaRef = useRef<TextInput>(null);

  const login = useMutation({
    mutationFn: () => iniciarSesion(correo, contrasena),
    onSuccess: ({ token }) => signIn(token),
  });
  const { message, fields } = describeError(login.error);
  const submit = () => {
    if (!login.isPending) {
      login.mutate();
    }
  };

  return (
    <FormScreen>
      <ThemedText variant="subhead">
        Reserva tu estacionamiento en el Campus San Joaquín y registra tu llegada con el código QR de la plaza.
      </ThemedText>

      {message ? <Notice message={message} /> : null}

      <View style={{ gap: spacing.md }}>
        <TextField
          label="Correo institucional"
          value={correo}
          onChangeText={setCorreo}
          error={fields.correo}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => contrasenaRef.current?.focus()}
        />
        <TextField
          ref={contrasenaRef}
          label="Contraseña"
          value={contrasena}
          onChangeText={setContrasena}
          error={fields.contrasena}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      <Button title="Iniciar sesión" onPress={submit} loading={login.isPending} />

      <View style={{ alignItems: "center", gap: spacing.md }}>
        <Link href="/registro" style={{ color: colors.accent, fontSize: 17, padding: spacing.sm }}>
          ¿No tienes cuenta? Crear cuenta
        </Link>
        <Link href="/diagnostico" style={{ color: colors.secondaryLabel, fontSize: 15, padding: spacing.sm }}>
          Verificar conexión con el servidor
        </Link>
      </View>
    </FormScreen>
  );
}
