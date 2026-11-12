import { CircleAlert, Lock, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { ApiError } from "../api";
import { useSession } from "../session";

export function LoginPage() {
  const { sesion, iniciar } = useSession();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sesion) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciar(correo, contrasena);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Ocurrió un error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-brand" aria-label="MiEstacionamientoUC">
        <span className="brand-mark lg" aria-hidden="true">
          P
        </span>
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          <p className="eyebrow" style={{ color: "rgb(255 255 255 / 0.75)" }}>
            Campus San Joaquín
          </p>
          <h1>Administración de estacionamientos</h1>
          <p>Gestiona cuentas, plazas y códigos QR de la zona piloto de MiEstacionamientoUC.</p>
        </div>
        <p style={{ fontSize: "0.85rem" }}>Acceso exclusivo para cuentas de administración.</p>
      </section>

      <main className="auth-form">
        <form onSubmit={onSubmit} className="auth-card" noValidate>
          <div className="stack" style={{ gap: "var(--space-1)" }}>
            <h1 style={{ fontSize: "1.5rem" }}>Iniciar sesión</h1>
            <p className="muted">Ingresa con tu cuenta de administración.</p>
          </div>

          {error && (
            <p role="alert" className="alert">
              <CircleAlert className="icon" aria-hidden="true" />
              {error}
            </p>
          )}

          <label className="field">
            Correo
            <span className="input">
              <Mail className="icon" aria-hidden="true" />
              <input
                type="email"
                autoComplete="username"
                placeholder="admin@demo.uc.cl"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                required
              />
            </span>
          </label>
          <label className="field">
            Contraseña
            <span className="input">
              <Lock className="icon" aria-hidden="true" />
              <input
                type="password"
                autoComplete="current-password"
                value={contrasena}
                onChange={(event) => setContrasena(event.target.value)}
                required
              />
            </span>
          </label>
          <button type="submit" disabled={enviando}>
            {enviando ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
      </main>
    </div>
  );
}
