import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, Lock, ShieldAlert, Siren } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, type Plaza } from "../api";
import { Empty, ErrorAlert, FieldError, formatoFechaHora, PageHeader, useApi } from "../ui";

type Incidente = {
  id: number;
  estado: "pendiente" | "validado" | "descartado" | "cerrado";
  descripcion: string;
  reportadoEn: string;
  reportadoPor: string;
  plaza: { id: number; codigo: string; zona: { nombre: string } };
  reserva: { id: number; fecha: string; llegada: string; salida: string; cuenta: { correo: string } } | null;
  resueltoPor: string | null;
  motivoResolucion: string | null;
  bloqueoVigente: boolean;
  sancion: number | null;
};

const ESTADOS = {
  pendiente: { texto: "Pendiente", clase: "warning" },
  validado: { texto: "Validado", clase: "danger" },
  descartado: { texto: "Descartado", clase: "" },
  cerrado: { texto: "Cerrado", clase: "success" },
} as const;

function Resolver({ incidente }: { incidente: Incidente }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [sancion, setSancion] = useState("");
  const [bloquear, setBloquear] = useState(false);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["admin"] });
  const resolver = useMutation({
    mutationFn: (resultado: "validado" | "descartado") =>
      api(`/admin/incidentes/${incidente.id}/resolver`, {
        method: "POST",
        body: { resultado, motivo, sancion: resultado === "validado" && sancion ? -Math.abs(Number(sancion)) : null, bloquear: resultado === "validado" && bloquear },
      }),
    onSuccess: refrescar,
  });
  const cerrar = useMutation({
    mutationFn: () => api(`/admin/incidentes/${incidente.id}/cerrar`, { method: "POST", body: { motivo } }),
    onSuccess: refrescar,
  });
  const error = resolver.error ?? cerrar.error;
  const detalles = error instanceof ApiError ? error.details : {};

  if (incidente.estado === "pendiente") {
    return (
      <div className="stack" style={{ gap: "var(--space-2)", minWidth: 280 }}>
        <span className="input">
          <input placeholder="Motivo de la resolución" aria-label={`Motivo para el incidente ${incidente.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </span>
        <FieldError message={detalles.motivo ?? detalles.sancion ?? detalles.resultado} />
        <div className="row-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          {incidente.reserva && (
            <span className="input" style={{ width: 120, minHeight: 32 }}>
              <input type="number" min={1} max={100} placeholder="Sanción" aria-label="Puntos a descontar" value={sancion} onChange={(e) => setSancion(e.target.value)} />
            </span>
          )}
          <label className="check">
            <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} />
            Bloquear plaza
          </label>
        </div>
        <div className="row-actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="danger small" disabled={resolver.isPending} onClick={() => resolver.mutate("validado")}>
            <ShieldAlert className="icon" aria-hidden="true" />
            Validar
          </button>
          <button type="button" className="secondary small" disabled={resolver.isPending} onClick={() => resolver.mutate("descartado")}>
            <CircleSlash className="icon" aria-hidden="true" />
            Descartar
          </button>
        </div>
        {error && !Object.keys(detalles).length && <span className="field-error">{error.message}</span>}
      </div>
    );
  }
  if (incidente.estado === "validado") {
    return (
      <div className="stack" style={{ gap: "var(--space-2)", minWidth: 240 }}>
        <span className="input">
          <input placeholder="Cómo se resolvió" aria-label={`Cierre del incidente ${incidente.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </span>
        <FieldError message={detalles.motivo} />
        <button type="button" className="secondary small" disabled={cerrar.isPending} onClick={() => cerrar.mutate()}>
          <CheckCircle2 className="icon" aria-hidden="true" />
          Cerrar{incidente.bloqueoVigente ? " y levantar bloqueo" : ""}
        </button>
      </div>
    );
  }
  return <span className="subtle">—</span>;
}

/** Incidentes reportados por personas o por administración, con su resolución (08A). */
export function IncidentesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<"" | Incidente["estado"]>("pendiente");
  const [form, setForm] = useState({ plazaId: "", descripcion: "" });
  const incidentes = useQuery({
    queryKey: ["admin", "incidentes", estado],
    queryFn: () => api<{ incidentes: Incidente[] }>(`/admin/incidentes${estado ? `?estado=${estado}` : ""}`),
  });
  const plazas = useQuery({ queryKey: ["admin", "plazas", "todas"], queryFn: () => api<{ plazas: Plaza[] }>("/admin/plazas") });
  const crear = useMutation({
    mutationFn: () => api("/admin/incidentes", { method: "POST", body: { plazaId: Number(form.plazaId) || undefined, descripcion: form.descripcion } }),
    onSuccess: () => {
      setForm({ plazaId: "", descripcion: "" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "incidentes"] });
    },
  });
  const detalles = crear.error instanceof ApiError ? crear.error.details : {};
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    crear.mutate();
  };
  const lista = incidentes.data?.incidentes ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Incidentes"
        description="Un incidente pendiente no tiene efectos. Al validarlo puedes descontar puntos al titular de la reserva y bloquear la plaza hasta cerrarlo."
      />

      <form className="card form-card" onSubmit={onSubmit} noValidate>
        <h2>Registrar incidente</h2>
        <div className="form-grid">
          <label className="field">
            Plaza
            <select value={form.plazaId} onChange={(e) => setForm({ ...form, plazaId: e.target.value })}>
              <option value="">Elige una plaza</option>
              {(plazas.data?.plazas ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.zona.nombre} · {p.codigo}
                </option>
              ))}
            </select>
            <FieldError message={detalles.plazaId} />
          </label>
          <label className="field" style={{ gridColumn: "span 2" }}>
            Descripción
            <span className="input">
              <input placeholder="Ej.: vehículo sin reserva ocupando la plaza" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </span>
            <FieldError message={detalles.descripcion} />
          </label>
        </div>
        <ErrorAlert error={!Object.keys(detalles).length ? crear.error : null} />
        <div className="form-actions">
          <button type="submit" disabled={crear.isPending}>
            <Siren className="icon" aria-hidden="true" />
            Registrar
          </button>
        </div>
      </form>

      <section className="card table-card" aria-labelledby="titulo-incidentes">
        <div className="table-toolbar">
          <h2 id="titulo-incidentes">Incidentes</h2>
          <select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="pendiente">Pendientes</option>
            <option value="validado">Validados</option>
            <option value="cerrado">Cerrados</option>
            <option value="descartado">Descartados</option>
            <option value="">Todos</option>
          </select>
        </div>
        <ErrorAlert error={incidentes.error} onRetry={() => incidentes.refetch()} />
        {incidentes.data && lista.length === 0 && <Empty icon={Siren}>No hay incidentes en este estado.</Empty>}
        {lista.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Reporte</th>
                  <th scope="col">Plaza y reserva</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Resolución</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id} style={{ verticalAlign: "top" }}>
                    <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                      <strong>#{i.id}</strong> {i.descripcion}
                      <div className="subtle">
                        {formatoFechaHora(i.reportadoEn)} · {i.reportadoPor}
                      </div>
                    </td>
                    <td>
                      {i.plaza.zona.nombre} · <strong>{i.plaza.codigo}</strong>
                      {i.reserva && (
                        <div className="subtle">
                          {i.reserva.fecha} {i.reserva.llegada}–{i.reserva.salida} · {i.reserva.cuenta.correo}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${ESTADOS[i.estado].clase}`}>{ESTADOS[i.estado].texto}</span>
                      {i.bloqueoVigente && (
                        <div className="subtle" style={{ marginTop: 4 }}>
                          <Lock size={12} aria-hidden="true" /> Plaza bloqueada
                        </div>
                      )}
                      {i.sancion && <div className="subtle">{i.sancion} puntos</div>}
                      {i.resueltoPor && (
                        <div className="subtle" style={{ whiteSpace: "normal" }}>
                          {i.resueltoPor}: {i.motivoResolucion}
                        </div>
                      )}
                    </td>
                    <td>
                      <Resolver incidente={i} />
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
