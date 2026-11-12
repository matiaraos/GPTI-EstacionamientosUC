import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { type TextInput, View } from "react-native";
import { iniciarSesion } from "@/api/cuentas";
import { describeError } from "@/api/errors";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/button";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

export default function IniciarSesionScreen() {
  const router = useRouter();
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
    if (!login.isPending) login.mutate();
  };

  return (
    <FormScreen sinEncabezado>
      <BrandMark />
      <ThemedText variant="callout" tone="secondary">
        Reserva una plaza cerca de tu clase y registra tu llegada con el código QR de la plaza.
      </ThemedText>

      {message ? <Notice message={message} /> : null}

      <View style={{ gap: spacing.md }}>
        <TextField
          label="Correo institucional"
          icon="mail"
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
          revelable
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title="Iniciar sesión" onPress={submit} loading={login.isPending} />
        <Button title="Crear una cuenta" variant="secondary" onPress={() => router.push("/registro")} />
      </View>

      <Button title="Verificar conexión con el servidor" variant="ghost" icon="wifi" onPress={() => router.push("/diagnostico")} />
    </FormScreen>
  );
}
