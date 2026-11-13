import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CircleCheck, CircleSlash, CircleX, FlaskConical, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api";
import { Empty, ErrorAlert, FieldError, formatoFechaHora, PageHeader, useApi } from "../ui";

type Indicador = {
  clave: string;
  nombre: string;
  valor: number | null;
  unidad: "personas" | "%" | "pares";
  numerador: number | null;
  denominador: number | null;
  detalle: string;
  meta: string;
  cumple: boolean | null;
  separado?: boolean;
};

type Reporte = { desde: string; hasta: string; modo: "real" | "simulacion"; acredita: boolean; nota: string; indicadores: Indicador[] };
type Resultado = { id: number; desde: string; hasta: string; modo: string; generadoEn: string; indicadores: Indicador[] };
type Medicion = { id: number; desde: string; hasta: string; porcentaje: number; fuente: string; simulada: boolean };

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());
const valor = (i: Indicador) => (i.valor === null ? "—" : `${i.valor}${i.unidad === "%" ? " %" : ""}`);

function Estado({ cumple }: { cumple: boolean | null }) {
  if (cumple === null)
    return (
      <span className="badge">
        <CircleSlash size={14} aria-hidden="true" /> Sin datos
      </span>
    );
  return cumple ? (
    <span className="badge success">
      <CircleCheck size={14} aria-hidden="true" /> Cumple
    </span>
  ) : (
    <span className="badge danger">
      <CircleX size={14} aria-hidden="true" /> No cumple
    </span>
  );
}

/** Indicadores agregados del piloto con sus denominadores, distinguiendo simulación y medición real (08B). */
export function IndicadoresPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [modo, setModo] = useState<"real" | "simulacion">("real");
  const [medicion, setMedicion] = useState({ porcentaje: "", fuente: "UptimeRobot" });

  const reporte = useQuery({
    queryKey: ["admin", "indicadores", desde, hasta, modo],
    queryFn: () => api<Reporte>(`/admin/indicadores?desde=${desde}&hasta=${hasta}&modo=${modo}`),
    enabled: Boolean(desde && hasta),
  });
  const resultados = useQuery({ queryKey: ["admin", "indicadores", "resultados"], queryFn: () => api<{ resultados: Resultado[] }>("/admin/indicadores/resultados") });
  const mediciones = useQuery({ queryKey: ["admin", "indicadores", "mediciones"], queryFn: () => api<{ mediciones: Medicion[] }>("/admin/indicadores/mediciones") });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["admin", "indicadores"] });

  const guardar = useMutation({ mutationFn: () => api("/admin/indicadores/resultados", { method: "POST", body: { desde, hasta, modo } }), onSuccess: refrescar });
  const medir = useMutation({
    mutationFn: () =>
      api("/admin/indicadores/mediciones", {
        method: "POST",
        body: { desde, hasta, porcentaje: Number(medicion.porcentaje), fuente: medicion.fuente, simulada: modo === "simulacion" },
      }),
    onSuccess: () => {
      setMedicion((m) => ({ ...m, porcentaje: "" }));
      void refrescar();
    },
  });
  const detallesMedicion = medir.error instanceof ApiError ? medir.error.details : {};
  const onMedir = (event: FormEvent) => {
    event.preventDefault();
    medir.mutate();
  };
  const r = reporte.data;

  return (
    <>
      <PageHeader
        eyebrow="Piloto"
        title="Indicadores"
        description="Metas del certificado de aceptación calculadas desde reservas, lecturas QR, encuestas, incidentes y mediciones de disponibilidad."
      >
        <div className="row-actions">
          <label className="input">
            <input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="input">
            <input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <select aria-label="Tipo de datos" value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
            <option value="real">Medición real</option>
            <option value="simulacion">Simulación</option>
          </select>
        </div>
      </PageHeader>

      <ErrorAlert error={reporte.error} onRetry={() => reporte.refetch()} />
      {r && (
        <p className={`alert ${r.modo === "simulacion" ? "" : r.acredita ? "success" : "info"}`} style={r.modo === "simulacion" ? { color: "var(--warning)", background: "var(--warning-soft)" } : undefined}>
          {r.modo === "simulacion" ? <FlaskConical className="icon" aria-hidden="true" /> : <BarChart3 className="icon" aria-hidden="true" />}
          {r.nota} {r.modo === "real" && (r.acredita ? "Se cumplen todas las metas del período." : "Aún no se cumplen todas las metas.")}
        </p>
      )}

      {r && (
        <section className="card table-card" aria-labelledby="titulo-indicadores">
          <div className="table-toolbar">
            <h2 id="titulo-indicadores">
              {r.desde === r.hasta ? r.desde : `${r.desde} a ${r.hasta}`} · {r.modo === "real" ? "medición real" : "simulación"}
            </h2>
            <button type="button" className="secondary" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
              <Save className="icon" aria-hidden="true" />
              Guardar resultado del período
            </button>
          </div>
          <ErrorAlert error={guardar.error} />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Indicador</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Numerador / denominador</th>
                  <th scope="col">Meta</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {r.indicadores.map((i) => (
                  <tr key={i.clave}>
                    <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                      <strong>{i.nombre}</strong>
                      {i.separado && <span className="subtle"> · se mide aparte</span>}
                      <div className="subtle">{i.detalle}</div>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{valor(i)}</td>
                    <td className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {i.numerador ?? "—"} / {i.denominador ?? "—"}
                    </td>
                    <td>{i.meta}</td>
                    <td>
                      <Estado cumple={i.cumple} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <form className="card form-card" onSubmit={onMedir} noValidate>
        <h2>Disponibilidad medida</h2>
        <p className="muted">
          Registra la disponibilidad de `/ready` del período ({desde} a {hasta}) según el monitoreo externo. Se guarda como {modo === "real" ? "medición real" : "simulación"}.
        </p>
        <div className="form-grid">
          <label className="field">
            Porcentaje
            <span className="input">
              <input type="number" min={0} max={100} step={0.01} placeholder="99.5" value={medicion.porcentaje} onChange={(e) => setMedicion({ ...medicion, porcentaje: e.target.value })} />
            </span>
            <FieldError message={detallesMedicion.porcentaje ?? detallesMedicion.hasta} />
          </label>
          <label className="field">
            Fuente
            <span className="input">
              <input value={medicion.fuente} onChange={(e) => setMedicion({ ...medicion, fuente: e.target.value })} />
            </span>
            <FieldError message={detallesMedicion.fuente} />
          </label>
        </div>
        <ErrorAlert error={!Object.keys(detallesMedicion).length ? medir.error : null} />
        <div className="form-actions">
          <button type="submit" disabled={medir.isPending || !medicion.porcentaje}>
            Registrar medición
          </button>
        </div>
        {mediciones.data && mediciones.data.mediciones.length > 0 && (
          <ul className="affected" style={{ color: "var(--text-muted)" }}>
            {mediciones.data.mediciones.slice(0, 6).map((m) => (
              <li key={m.id}>
                {m.desde} a {m.hasta}: {m.porcentaje} % · {m.fuente}
                {m.simulada ? " (simulación)" : ""}
              </li>
            ))}
          </ul>
        )}
      </form>

      <section className="card table-card" aria-labelledby="titulo-resultados">
        <div className="table-toolbar">
          <h2 id="titulo-resultados">Resultados guardados</h2>
          <span className="subtle">Agregados y anónimos: es lo que se conserva al cerrar el piloto.</span>
        </div>
        <ErrorAlert error={resultados.error} onRetry={() => resultados.refetch()} />
        {resultados.data && resultados.data.resultados.length === 0 && <Empty icon={BarChart3}>Aún no hay resultados guardados.</Empty>}
        {resultados.data && resultados.data.resultados.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Período</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Metas cumplidas</th>
                  <th scope="col">Guardado</th>
                </tr>
              </thead>
              <tbody>
                {resultados.data.resultados.map((res) => {
                  const metas = res.indicadores.filter((i) => !i.separado);
                  return (
                    <tr key={res.id}>
                      <td>
                        {res.desde} a {res.hasta}
                      </td>
                      <td>{res.modo === "real" ? <span className="badge accent">Medición real</span> : <span className="badge warning">Simulación</span>}</td>
                      <td>
                        {metas.filter((i) => i.cumple).length} de {metas.length}
                      </td>
                      <td className="muted">{formatoFechaHora(res.generadoEn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
