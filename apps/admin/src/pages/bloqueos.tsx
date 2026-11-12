import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Construction, Lock, LockOpen } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, type Bloqueo, type Plaza, type ReservaAfectada } from "../api";
import { Empty, ErrorAlert, FieldError, PageHeader, useApi } from "../ui";
import { ReservasAfectadas } from "./afectadas";

/** `AAAA-MM-DDTHH:mm` en hora de Santiago, para los campos `datetime-local`. */
function ahoraLocal(desplazamientoHoras = 0) {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Date.now() + desplazamientoHoras * 3_600_000));
  return partes.replace(" ", "T");
}

/** Bloqueos temporales de plazas: las excluyen de nuevas asignaciones mientras estén vigentes (02B). */
export function BloqueosPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [historial, setHistorial] = useState(false);
  const [form, setForm] = useState({ plazaId: "", inicio: ahoraLocal(), fin: ahoraLocal(4), motivo: "" });
  const [afectadas, setAfectadas] = useState<ReservaAfectada[]>([]);

  const plazas = useQuery({ queryKey: ["admin", "plazas", "todas"], queryFn: () => api<{ plazas: Plaza[] }>("/admin/plazas") });
  const bloqueos = useQuery({
    queryKey: ["admin", "bloqueos", historial],
    queryFn: () => api<{ bloqueos: Bloqueo[] }>(`/admin/bloqueos?todos=${historial ? 1 : 0}`),
  });
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "bloqueos"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "plazas"] });
  };

  const crear = useMutation({
    mutationFn: () =>
      api<{ reservasAfectadas: ReservaAfectada[] }>("/admin/bloqueos", {
        method: "POST",
        body: { ...form, plazaId: Number(form.plazaId) || undefined },
      }),
    onSuccess: ({ reservasAfectadas }) => {
      setAfectadas(reservasAfectadas);
      setForm((f) => ({ ...f, motivo: "" }));
      refrescar();
    },
  });
  const levantar = useMutation({
    mutationFn: (id: number) => api(`/admin/bloqueos/${id}/levantar`, { method: "POST" }),
    onSuccess: refrescar,
  });
  const detalles = crear.error instanceof ApiError ? crear.error.details : {};
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAfectadas([]);
    crear.mutate();
  };

  const porZona = new Map<string, Plaza[]>();
  for (const plaza of plazas.data?.plazas ?? []) {
    porZona.set(plaza.zona.nombre, [...(porZona.get(plaza.zona.nombre) ?? []), plaza]);
  }

  return (
    <>
      <PageHeader eyebrow="Inventario" title="Bloqueos" description="Excluye una plaza de las nuevas asignaciones durante un período (mantención, eventos, incidentes)." />

      <form className="card form-card" onSubmit={onSubmit} noValidate>
        <h2>Nuevo bloqueo</h2>
        <div className="form-grid">
          <label className="field">
            Plaza
            <select value={form.plazaId} onChange={(e) => setForm({ ...form, plazaId: e.target.value })}>
              <option value="">Elige una plaza</option>
              {[...porZona.entries()].map(([zona, lista]) => (
                <optgroup key={zona} label={zona}>
                  {lista.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo}
                      {p.tipo === "preferente" ? " (preferente)" : ""}
                      {p.activa ? "" : " · inactiva"}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <FieldError message={detalles.plazaId} />
          </label>
          <label className="field">
            Desde
            <span className="input">
              <input type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </span>
            <FieldError message={detalles.inicio} />
          </label>
          <label className="field">
            Hasta
            <span className="input">
              <input type="datetime-local" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} />
            </span>
            <FieldError message={detalles.fin} />
          </label>
        </div>
        <label className="field">
          Motivo
          <span className="input">
            <input placeholder="Ej.: repintado de la demarcación" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </span>
          <FieldError message={detalles.motivo} />
        </label>
        <ErrorAlert error={!Object.keys(detalles).length ? crear.error : null} />
        {crear.isSuccess && <p className="alert success">Bloqueo registrado. La plaza queda fuera de nuevas asignaciones en ese período.</p>}
        <ReservasAfectadas reservas={afectadas} titulo="Reservas vigentes que se cruzan con el bloqueo" />
        <div className="form-actions">
          <button type="submit" disabled={crear.isPending}>
            <Lock className="icon" aria-hidden="true" />
            {crear.isPending ? "Bloqueando…" : "Bloquear plaza"}
          </button>
        </div>
      </form>

      <section className="card table-card" aria-labelledby="titulo-bloqueos">
        <div className="table-toolbar">
          <h2 id="titulo-bloqueos">{historial ? "Historial de bloqueos" : "Bloqueos vigentes y programados"}</h2>
          <label className="check">
            <input type="checkbox" checked={historial} onChange={(e) => setHistorial(e.target.checked)} />
            Mostrar historial
          </label>
        </div>
        <ErrorAlert error={bloqueos.error ?? levantar.error} onRetry={() => bloqueos.refetch()} />
        {bloqueos.isLoading && <p className="empty">Cargando bloqueos…</p>}
        {bloqueos.data && bloqueos.data.bloqueos.length === 0 && <Empty icon={Construction}>No hay bloqueos {historial ? "registrados" : "vigentes"}.</Empty>}
        {bloqueos.data && bloqueos.data.bloqueos.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Plaza</th>
                  <th scope="col">Período</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Registró</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bloqueos.data.bloqueos.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.plaza.codigo}</strong>
                      <div className="subtle">{b.plaza.zona.nombre}</div>
                    </td>
                    <td>
                      {b.inicioLocal} → {b.finLocal}
                    </td>
                    <td style={{ whiteSpace: "normal", minWidth: 200 }}>{b.motivo}</td>
                    <td className="muted">{b.creadoPor.correo}</td>
                    <td>
                      {b.levantadoEn ? (
                        <span className="badge">Levantado</span>
                      ) : new Date(b.fin) <= new Date() ? (
                        <span className="badge">Terminado</span>
                      ) : (
                        <span className="badge warning">Vigente</span>
                      )}
                    </td>
                    <td>
                      {!b.levantadoEn && new Date(b.fin) > new Date() && (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="secondary small"
                            disabled={levantar.isPending}
                            onClick={() => {
                              if (window.confirm(`¿Levantar el bloqueo de ${b.plaza.codigo}?`)) levantar.mutate(b.id);
                            }}
                          >
                            <LockOpen className="icon" aria-hidden="true" />
                            Levantar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
