import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { solicitarRecuperacion } from "@/api/cuentas";
import { describeError } from "@/api/errors";
import { Button } from "@/components/button";
import { FormScreen } from "@/components/form-screen";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/theme";

export default function RecuperarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ correo?: string }>();
  const [correo, setCorreo] = useState(params.correo ?? "");
  const solicitud = useMutation({ mutationFn: () => solicitarRecuperacion(correo) });
  const { message, fields } = describeError(solicitud.error);
  const submit = () => {
    if (!solicitud.isPending) solicitud.mutate();
  };

  return (
    <FormScreen>
      <ThemedText variant="callout" tone="secondary">
        Te enviaremos un enlace a tu correo institucional para elegir una nueva contraseña. Ábrelo desde este teléfono.
      </ThemedText>

      {message ? <Notice message={message} /> : null}
      {solicitud.data ? <Notice tone="success" message={solicitud.data.mensaje} /> : null}

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
        returnKeyType="send"
        onSubmitEditing={submit}
      />

      <View style={{ gap: spacing.sm }}>
        <Button
          title={solicitud.data ? "Enviar de nuevo" : "Enviar enlace"}
          icon="mail"
          onPress={submit}
          loading={solicitud.isPending}
        />
        <Button
          title="Ya tengo el enlace"
          variant="ghost"
          icon="link"
          onPress={() => router.push("/restablecer")}
        />
      </View>
    </FormScreen>
  );
}
