import { useState } from "react";
import { Button, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { checkReadiness, hasApiUrl } from "../api/readiness";

export default function ConnectionScreen() {
  const [message, setMessage] = useState("Pendiente de verificar.");
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    if (!hasApiUrl) {
      setMessage("Configura EXPO_PUBLIC_API_URL para conectarte a la API.");
      return;
    }

    setChecking(true);
    setMessage("Verificando conexión…");
    try {
      const available = await checkReadiness();
      setMessage(available ? "API y base de datos disponibles." : "El servicio no está disponible.");
    } catch {
      setMessage("No se pudo contactar a la API.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text>Campus San Joaquín</Text>
      <Text accessibilityRole="header" style={styles.title}>MiEstacionamientoUC</Text>
      <Button title="Verificar conexión" disabled={checking} onPress={checkConnection} />
      <Text accessibilityLiveRegion="polite">{message}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: "#f1f5fa",
  },
  title: {
    fontSize: 27,
    fontWeight: "700",
    color: "#182c44",
  },
});
