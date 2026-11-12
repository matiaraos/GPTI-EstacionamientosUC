import { useState } from "react";
import { apiRequest, apiUrl } from "../api";

export function DiagnosticoPage() {
  const [message, setMessage] = useState("Pendiente de verificar.");
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);
    setMessage("Verificando conexión…");
    try {
      await apiRequest("/ready", { timeoutMs: 5000 });
      setMessage("API y base de datos disponibles.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.startsWith("No se pudo")
          ? "No se pudo contactar a la API."
          : "El servicio no está disponible.",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="stack">
      <h1>Diagnóstico</h1>
      <p className="muted">API: {apiUrl ?? "sin configurar (VITE_API_URL)"}</p>
      <div>
        <button type="button" disabled={checking} onClick={checkConnection}>
          Verificar conexión
        </button>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
