import { CircleAlert, type LucideIcon } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { apiRequest } from "./api";
import { useSession } from "./session";

/** `apiRequest` con el token de la sesión del panel. */
export function useApi() {
  const { sesion } = useSession();
  const token = sesion?.token;
  return useCallback(
    <T,>(path: string, options: { method?: string; body?: unknown } = {}) => apiRequest<T>(path, { ...options, token }),
    [token],
  );
}

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="stack">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </header>
  );
}

export function ErrorAlert({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="alert">
      <CircleAlert className="icon" aria-hidden="true" />
      <span style={{ flex: 1 }}>{error.message}</span>
      {onRetry && (
        <button type="button" className="secondary small" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Empty({ icon: Icono, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="stat-icon" aria-hidden="true">
        <Icono className="icon" />
      </span>
      <p>{children}</p>
    </div>
  );
}

/** Mensaje de error por campo bajo un control. */
export function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null;
}

const fechaHora = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" });
const fecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" });

export const formatoFechaHora = (valor: string | Date) => fechaHora.format(new Date(valor));
export const formatoFecha = (valor: string | Date) => fecha.format(new Date(valor));
