import { useQuery } from "@tanstack/react-query";
import { Ban, CarFront, CircleCheck, Clock, Lock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ErrorAlert, PageHeader, useApi } from "../ui";

type EstadoPlaza = "libre" | "reservada" | "en_uso" | "bloqueada" | "inactiva";

type Ocupacion = {
  instante: string;
  totales: Record<EstadoPlaza, number>;
  plazas: {
    id: number;
    codigo: string;
    tipo: "regular" | "preferente";
    zona: { id: number; nombre: string };
    estado: EstadoPlaza;
    motivoBloqueo: string | null;
    reserva: { id: number; llegada: string; salida: string; cuenta: string } | null;
    incidentesAbiertos: number;
  }[];
};

type Periodo = {
  desde: string;
  hasta: string;
  reservas: { total: number; confirmada: number; en_uso: number; finalizada: number; cancelada: number; ausente: number; vencida: number };
  eventos: { entradas: number; salidas: number };
  salidasATiempo: number;
  incidentes: { pendiente: number; validado: number; descartado: number; cerrado: number };
};

const ESTADOS: Record<EstadoPlaza, { texto: string; clase: string; icono: typeof Clock }> = {
  libre: { texto: "Libres", clase: "success", icono: CircleCheck },
  reservada: { texto: "Reservadas", clase: "accent", icono: Clock },
  en_uso: { texto: "En uso", clase: "warning", icono: CarFront },
  bloqueada: { texto: "Bloqueadas", clase: "danger", icono: Lock },
  inactiva: { texto: "Inactivas", clase: "", icono: Ban },
};

const SINGULAR: Record<EstadoPlaza, string> = { libre: "Libre", reservada: "Reservada", en_uso: "En uso", bloqueada: "Bloqueada", inactiva: "Inactiva" };

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());

/** Ocupación actual por plaza y resumen del período (08A). */
export function OcupacionPage() {
  const api = useApi();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const ocupacion = useQuery({
    queryKey: ["admin", "ocupacion"],
    queryFn: () => api<Ocupacion>("/admin/ocupacion"),
    refetchInterval: 30_000,
  });
  const periodo = useQuery({
    queryKey: ["admin", "ocupacion", "periodo", desde, hasta],
    queryFn: () => api<Periodo>(`/admin/ocupacion/periodo?desde=${desde}&hasta=${hasta}`),
    enabled: Boolean(desde && hasta),
  });

  const porZona = new Map<string, Ocupacion["plazas"]>();
  for (const p of ocupacion.data?.plazas ?? []) porZona.set(p.zona.nombre, [...(porZona.get(p.zona.nombre) ?? []), p]);
  const r = periodo.data?.reservas;

  return (
    <>
      <PageHeader eyebrow="Operación" title="Ocupación" description="Estado actual de cada plaza, derivado de reservas, registros QR y bloqueos. Se actualiza cada 30 segundos.">
        <button type="button" className="secondary" onClick={() => ocupacion.refetch()} disabled={ocupacion.isFetching}>
          <RefreshCw className="icon" aria-hidden="true" />
          Actualizar
        </button>
      </PageHeader>
      <ErrorAlert error={ocupacion.error} onRetry={() => ocupacion.refetch()} />

      {ocupacion.data && (
        <section className="stats" aria-label="Plazas por estado">
          {(Object.keys(ESTADOS) as EstadoPlaza[]).map((estado) => {
            const { texto, icono: Icono } = ESTADOS[estado];
            return (
              <div key={estado} className="card stat">
                <span className="stat-icon" aria-hidden="true">
                  <Icono className="icon" />
                </span>
                <div>
                  <div className="stat-value">{ocupacion.data.totales[estado]}</div>
                  <div className="muted">{texto}</div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {[...porZona.entries()].map(([zona, plazas]) => (
        <section key={zona} className="card table-card" aria-label={zona}>
          <div className="table-toolbar">
            <h2>{zona}</h2>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Plaza</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Detalle</th>
                  <th scope="col">Incidentes</th>
                </tr>
              </thead>
              <tbody>
                {plazas.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.codigo}</strong> {p.tipo === "preferente" && <span className="subtle">· preferente</span>}
                    </td>
                    <td>
                      <span className={`badge ${ESTADOS[p.estado].clase}`}>{SINGULAR[p.estado]}</span>
                    </td>
                    <td className="muted">
                      {p.reserva ? `${p.reserva.llegada}–${p.reserva.salida} · ${p.reserva.cuenta}` : (p.motivoBloqueo ?? "—")}
                    </td>
                    <td>{p.incidentesAbiertos > 0 ? <span className="badge warning">{p.incidentesAbiertos} abiertos</span> : <span className="subtle">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="card form-card" aria-labelledby="titulo-periodo">
        <div className="table-toolbar" style={{ padding: 0, border: 0 }}>
          <h2 id="titulo-periodo">Resumen del período</h2>
          <div className="row-actions">
            <label className="input">
              <input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="input">
              <input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
        </div>
        <ErrorAlert error={periodo.error} onRetry={() => periodo.refetch()} />
        {periodo.data && r && (
          <div className="table-scroll">
            <table>
              <tbody>
                <tr>
                  <th scope="row">Reservas del período</th>
                  <td>{r.total}</td>
                </tr>
                <tr>
                  <th scope="row">Salida registrada</th>
                  <td>
                    {r.finalizada} <span className="subtle">({periodo.data.salidasATiempo} a tiempo)</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Vencidas sin salida</th>
                  <td>{r.vencida}</td>
                </tr>
                <tr>
                  <th scope="row">Ausencias</th>
                  <td>{r.ausente}</td>
                </tr>
                <tr>
                  <th scope="row">Canceladas</th>
                  <td>{r.cancelada}</td>
                </tr>
                <tr>
                  <th scope="row">Confirmadas o en uso</th>
                  <td>{r.confirmada + r.en_uso}</td>
                </tr>
                <tr>
                  <th scope="row">Lecturas QR (entradas / salidas)</th>
                  <td>
                    {periodo.data.eventos.entradas} / {periodo.data.eventos.salidas}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Incidentes pendientes</th>
                  <td>{periodo.data.incidentes.pendiente}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
