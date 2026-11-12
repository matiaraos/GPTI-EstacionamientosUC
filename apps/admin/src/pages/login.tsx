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
    <main className="auth">
      <p className="eyebrow">Campus San Joaquín</p>
      <h1>MiEstacionamientoUC</h1>
      <p className="muted">Panel administrativo. Ingresa con una cuenta de administración.</p>
      <form onSubmit={onSubmit} className="stack" noValidate>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span>Correo</span>
          <input
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={enviando}>
          {enviando ? "Ingresando…" : "Iniciar sesión"}
        </button>
      </form>
    </main>
  );
}
