import { Activity, CircleAlert, CircleCheck } from "lucide-react";
import { useState } from "react";
import { apiRequest, apiUrl } from "../api";

type Estado = { tono: "info" | "success" | "danger"; mensaje: string };

export function DiagnosticoPage() {
  const [estado, setEstado] = useState<Estado>({ tono: "info", mensaje: "Pendiente de verificar." });
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);
    setEstado({ tono: "info", mensaje: "Verificando conexión…" });
    try {
      await apiRequest("/ready", { timeoutMs: 5000 });
      setEstado({ tono: "success", mensaje: "API y base de datos disponibles." });
    } catch (error) {
      setEstado({
        tono: "danger",
        mensaje: error instanceof Error && error.message.startsWith("No se pudo") ? "No se pudo contactar a la API." : "El servicio no está disponible.",
      });
    } finally {
      setChecking(false);
    }
  }

  const Icono = estado.tono === "success" ? CircleCheck : estado.tono === "danger" ? CircleAlert : Activity;
  const colores =
    estado.tono === "success"
      ? { background: "var(--success-soft)", color: "var(--success)" }
      : estado.tono === "danger"
        ? { background: "var(--danger-soft)", color: "var(--danger)" }
        : undefined;

  return (
    <>
      <header className="page-header">
        <div className="stack">
          <p className="eyebrow">Sistema</p>
          <h1>Diagnóstico</h1>
          <p className="muted">Comprueba que el panel llega a la API y que la API llega a PostgreSQL.</p>
        </div>
        <button type="button" disabled={checking} onClick={checkConnection}>
          <Activity className="icon" aria-hidden="true" />
          Verificar conexión
        </button>
      </header>

      <section className="card status-card">
        <span className="stat-icon" style={colores} aria-hidden="true">
          <Icono className="icon" />
        </span>
        <div>
          <p role="status" style={{ fontWeight: 600 }}>
            {estado.mensaje}
          </p>
          <p className="subtle">API: {apiUrl ?? "sin configurar (VITE_API_URL)"}</p>
        </div>
      </section>
    </>
  );
}
