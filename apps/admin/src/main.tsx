import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function App() {
  const [message, setMessage] = useState("Pendiente de verificar.");
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    if (!apiUrl) {
      setMessage("Configura VITE_API_URL para conectarte a la API.");
      return;
    }

    setChecking(true);
    setMessage("Verificando conexión…");
    try {
      const response = await fetch(`${apiUrl}/ready`, { signal: AbortSignal.timeout(5000) });
      setMessage(response.ok ? "API y base de datos disponibles." : "El servicio no está disponible.");
    } catch {
      setMessage("No se pudo contactar a la API.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <p>Campus San Joaquín</p>
      <h1>MiEstacionamientoUC</h1>
      <h2>Panel administrativo</h2>
      <button disabled={checking} onClick={checkConnection}>Verificar conexión</button>
      <p role="status">{message}</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
