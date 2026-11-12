import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayCircle, Scale, Trophy } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { ApiError, type Cuenta } from "../api";
import { Empty, ErrorAlert, FieldError, formatoFechaHora, PageHeader, useApi } from "../ui";

type Ajuste = {
  id: number;
  tipo: "ausencia" | "vencimiento" | "salida_a_tiempo" | "salida_tardia" | "rectificacion";
  variacion: number;
  motivo: string;
  registradoEn: string;
  rectificadoPor: string | null;
  reserva: { id: number; fecha: string; llegada: string; salida: string; plaza: string; zona: string } | null;
};

const TIPOS: Record<Ajuste["tipo"], string> = {
  ausencia: "Ausencia",
  vencimiento: "Salida vencida",
  salida_a_tiempo: "Salida a tiempo",
  salida_tardia: "Salida tardía",
  rectificacion: "Rectificación",
};

const nuevaClave = () => crypto.randomUUID();

function Historial({ cuenta }: { cuenta: Cuenta }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [variacion, setVariacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [reservaId, setReservaId] = useState("");
  // Una clave por rectificación: si la respuesta se pierde y se reenvía, no se duplica.
  const clave = useRef(nuevaClave());
  const historial = useQuery({
    queryKey: ["admin", "ranking", cuenta.id],
    queryFn: () => api<{ puntaje: number; ajustes: Ajuste[] }>(`/admin/cuentas/${cuenta.id}/ranking`),
  });
  const rectificar = useMutation({
    mutationFn: () =>
      api(`/admin/cuentas/${cuenta.id}/ranking/rectificaciones`, {
        method: "POST",
        body: { variacion: Number(variacion), motivo, reservaId: reservaId ? Number(reservaId) : null },
        headers: { "Idempotency-Key": clave.current },
      }),
    onSuccess: () => {
      clave.current = nuevaClave();
      setVariacion("");
      setMotivo("");
      setReservaId("");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const detalles = rectificar.error instanceof ApiError ? rectificar.error.details : {};
  const reservas = new Map((historial.data?.ajustes ?? []).flatMap((a) => (a.reserva ? [[a.reserva.id, a.reserva] as const] : [])));
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (window.confirm(`¿Registrar una rectificación de ${variacion} puntos para ${cuenta.correo}?`)) rectificar.mutate();
  };

  return (
    <>
      <section className="card table-card" aria-labelledby="titulo-historial">
        <div className="table-toolbar">
          <h2 id="titulo-historial">
            {cuenta.correo} · {historial.data?.puntaje ?? cuenta.puntaje} puntos
          </h2>
        </div>
        <ErrorAlert error={historial.error} onRetry={() => historial.refetch()} />
        {historial.data && historial.data.ajustes.length === 0 && <Empty icon={Trophy}>Esta cuenta aún no tiene ajustes.</Empty>}
        {historial.data && historial.data.ajustes.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Variación</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Reserva</th>
                </tr>
              </thead>
              <tbody>
                {historial.data.ajustes.map((a) => (
                  <tr key={a.id}>
                    <td className="muted">{formatoFechaHora(a.registradoEn)}</td>
                    <td>
                      <span className={`badge ${a.tipo === "rectificacion" ? "accent" : a.variacion < 0 ? "danger" : "success"}`}>{TIPOS[a.tipo]}</span>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {a.variacion > 0 ? "+" : ""}
                      {a.variacion}
                    </td>
                    <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                      {a.motivo}
                      {a.rectificadoPor && <div className="subtle">Registró {a.rectificadoPor}</div>}
                    </td>
                    <td className="muted">{a.reserva ? `${a.reserva.fecha} ${a.reserva.llegada}–${a.reserva.salida} · ${a.reserva.zona} ${a.reserva.plaza}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form className="card form-card" onSubmit={onSubmit} noValidate>
        <h2>
          <Scale className="icon" aria-hidden="true" /> Rectificación justificada
        </h2>
        <p className="muted">Corrige un ajuste o sanciona un mal uso validado. Queda registrada con tu cuenta y la persona la ve en su historial.</p>
        <div className="form-grid">
          <label className="field">
            Variación (puntos)
            <span className="input">
              <input type="number" step={1} min={-100} max={100} placeholder="-10 o 5" value={variacion} onChange={(e) => setVariacion(e.target.value)} />
            </span>
            <FieldError message={detalles.variacion} />
          </label>
          <label className="field">
            Reserva asociada (opcional)
            <select value={reservaId} onChange={(e) => setReservaId(e.target.value)}>
              <option value="">Sin reserva</option>
              {[...reservas.values()].map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fecha} {r.llegada}–{r.salida} · {r.plaza}
                </option>
              ))}
            </select>
            <FieldError message={detalles.reservaId} />
          </label>
        </div>
        <label className="field">
          Justificación
          <span className="input">
            <input placeholder="Ej.: la ausencia se debió a un corte de acceso informado por el campus" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </span>
          <FieldError message={detalles.motivo} />
        </label>
        <ErrorAlert error={!Object.keys(detalles).length ? rectificar.error : null} />
        {rectificar.isSuccess && <p className="alert success">Rectificación registrada.</p>}
        <div className="form-actions">
          <button type="submit" disabled={rectificar.isPending || !variacion}>
            {rectificar.isPending ? "Guardando…" : "Registrar rectificación"}
          </button>
        </div>
      </form>
    </>
  );
}

/** Puntajes de ranking, historial de ajustes y rectificaciones (05B). */
export function RankingPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const cuentas = useQuery({ queryKey: ["admin", "cuentas"], queryFn: () => api<{ cuentas: Cuenta[] }>("/admin/cuentas") });
  const usuarios = (cuentas.data?.cuentas ?? []).filter((c) => c.rol === "usuario").sort((a, b) => (a.puntaje ?? 0) - (b.puntaje ?? 0));
  const elegida = usuarios.find((c) => c.id === Number(params.get("cuenta")));
  const procesar = useMutation({
    mutationFn: () => api<{ ausentes: number[]; vencidas: number[] }>("/admin/procesos/vencimientos", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  return (
    <>
      <PageHeader eyebrow="Cumplimiento" title="Ranking" description="Puntaje de cada cuenta según ausencias, vencimientos y salidas a tiempo, con sus rectificaciones.">
        <button type="button" className="secondary" onClick={() => procesar.mutate()} disabled={procesar.isPending}>
          <PlayCircle className="icon" aria-hidden="true" />
          Procesar vencimientos ahora
        </button>
      </PageHeader>
      <ErrorAlert error={cuentas.error ?? procesar.error} onRetry={() => cuentas.refetch()} />
      {procesar.data && (
        <p className="alert info">
          Proceso ejecutado: {procesar.data.ausentes.length} ausencias y {procesar.data.vencidas.length} salidas vencidas nuevas.
        </p>
      )}

      <section className="card table-card" aria-labelledby="titulo-ranking">
        <div className="table-toolbar">
          <h2 id="titulo-ranking">Cuentas</h2>
          <span className="subtle">Ordenadas de menor a mayor puntaje.</span>
        </div>
        {cuentas.isLoading && <p className="empty">Cargando…</p>}
        {cuentas.data && usuarios.length === 0 && <Empty icon={Trophy}>No hay cuentas de usuario.</Empty>}
        {usuarios.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((c) => (
                  <tr key={c.id} className={`clickable ${c.id === elegida?.id ? "selected" : ""}`} onClick={() => setParams({ cuenta: String(c.id) })}>
                    <td>
                      <button type="button" className="ghost small" style={{ color: "var(--text)", padding: 0 }}>
                        {c.correo}
                      </button>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{c.puntaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {elegida && <Historial key={elegida.id} cuenta={elegida} />}
    </>
  );
}
