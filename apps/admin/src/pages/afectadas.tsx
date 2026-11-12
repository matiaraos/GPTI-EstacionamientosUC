import { TriangleAlert } from "lucide-react";
import type { ReservaAfectada } from "../api";

/** Aviso con las reservas vigentes que quedan afectadas por un cambio de inventario. */
export function ReservasAfectadas({ reservas, titulo }: { reservas: ReservaAfectada[]; titulo: string }) {
  if (reservas.length === 0) return null;
  return (
    <div role="status" className="alert" style={{ color: "var(--warning)", background: "var(--warning-soft)" }}>
      <TriangleAlert className="icon" aria-hidden="true" />
      <div className="stack" style={{ gap: "var(--space-2)" }}>
        <strong>
          {titulo} ({reservas.length})
        </strong>
        <ul className="affected">
          {reservas.slice(0, 8).map((r) => (
            <li key={r.id}>
              {r.fecha} {r.llegada}–{r.salida} · {r.zona.nombre} {r.plaza.codigo} · {r.cuenta.correo}
            </li>
          ))}
        </ul>
        {reservas.length > 8 && <span>y {reservas.length - 8} más.</span>}
        <span style={{ fontWeight: 400 }}>Las reservas no se cancelan solas: avisa a cada persona o reasigna su plaza.</span>
      </div>
    </div>
  );
}

/** Texto para confirmar un cambio que afecta reservas vigentes. */
export function confirmarAfectadas(accion: string, reservas: ReservaAfectada[]): boolean {
  if (reservas.length === 0) return window.confirm(`¿${accion}?`);
  const lista = reservas
    .slice(0, 5)
    .map((r) => `• ${r.fecha} ${r.llegada}–${r.salida} · ${r.cuenta.correo}`)
    .join("\n");
  return window.confirm(`¿${accion}?\n\nHay ${reservas.length} reserva(s) vigente(s) en esta plaza:\n${lista}\n\nLas reservas no se cancelan solas.`);
}
