import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { type TextInput, View } from "react-native";
import { iniciarSesion, registrar } from "@/api/cuentas";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/session/session-provider";
import { spacing } from "@/theme";

const dominio = process.env.EXPO_PUBLIC_EMAIL_DOMAIN?.trim() || "demo.uc.cl";

export default function RegistroScreen() {
  const { signIn } = useSession();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [patente, setPatente] = useState("");
  const contrasenaRef = useRef<TextInput>(null);
  const patenteRef = useRef<TextInput>(null);

  // Tras registrar se inicia sesión con las mismas credenciales.
  const registro = useMutation({
    mutationFn: async () => {
      await registrar({ correo, contrasena, patente });
      return iniciarSesion(correo, contrasena);
    },
    onSuccess: ({ token }) => signIn(token),
  });
  const { message, fields } = describeError(registro.error);
  const submit = () => {
    if (!registro.isPending) {
      registro.mutate();
    }
  };

  return (
    <FormScreen>
      <ThemedText variant="subhead">
        Usa tu correo @{dominio}. La patente identifica el vehículo con el que usarás las plazas reservadas.
      </ThemedText>

      {message ? <Notice message={message} /> : null}

      <View style={{ gap: spacing.md }}>
        <TextField
          label="Correo institucional"
          placeholder={`nombre@${dominio}`}
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
          hint="Mínimo 8 caracteres."
          value={contrasena}
          onChangeText={setContrasena}
          error={fields.contrasena}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => patenteRef.current?.focus()}
        />
        <TextField
          ref={patenteRef}
          label="Patente del vehículo"
          placeholder="AB1234 o BCDF12"
          value={patente}
          onChangeText={setPatente}
          error={fields.patente}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>

      <Button title="Crear cuenta" onPress={submit} loading={registro.isPending} />
    </FormScreen>
  );
}
