import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, Plus, QrCode, RefreshCw, Save, SquareParking, Warehouse } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { ApiError, type Horario, type Plaza, type ReservaAfectada, type Zona } from "../api";
import { Empty, ErrorAlert, FieldError, PageHeader, useApi } from "../ui";
import { confirmarAfectadas, ReservasAfectadas } from "./afectadas";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function resumenHorario(horarios: Horario[]): string {
  if (horarios.length === 0) return "Sin horario";
  const habiles = horarios.filter((h) => h.diaSemana <= 5);
  const primero = horarios[0];
  if (habiles.length === 5 && habiles.every((h) => h.abre === primero.abre && h.cierra === primero.cierra)) {
    const extra = horarios.length - 5;
    return `L–V ${primero.abre}–${primero.cierra}${extra > 0 ? ` +${extra} día${extra > 1 ? "s" : ""}` : ""}`;
  }
  return `${horarios.length} días`;
}

function EditorHorario({ zona }: { zona: Zona }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const inicial = () =>
    DIAS.map((_, i) => {
      const h = zona.horarios.find((x) => x.diaSemana === i + 1);
      return { abierto: Boolean(h), abre: h?.abre ?? "07:00", cierra: h?.cierra ?? "22:00" };
    });
  const [filas, setFilas] = useState(inicial);
  useEffect(() => setFilas(inicial()), [zona.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = useMutation({
    mutationFn: () =>
      api("/admin/zonas/" + zona.id + "/horarios", {
        method: "PUT",
        body: {
          horarios: filas.flatMap((f, i) => (f.abierto ? [{ diaSemana: i + 1, abre: f.abre, cierra: f.cierra }] : [])),
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "zonas"] }),
  });
  const detalles = guardar.error instanceof ApiError ? guardar.error.details : {};

  return (
    <form
      className="card form-card"
      onSubmit={(event) => {
        event.preventDefault();
        guardar.mutate();
      }}
    >
      <h2>
        <CalendarClock className="icon" aria-hidden="true" /> Horario semanal
      </h2>
      <p className="muted">Hora de Santiago. Un día sin marcar queda cerrado y no admite reservas.</p>
      <div className="schedule">
        {filas.map((fila, i) => (
          <div key={DIAS[i]} className="schedule-row">
            <label className="check">
              <input
                type="checkbox"
                checked={fila.abierto}
                onChange={(e) => setFilas(filas.map((f, j) => (j === i ? { ...f, abierto: e.target.checked } : f)))}
              />
              {DIAS[i]}
            </label>
            <span className="subtle">{fila.abierto ? "Abierto" : "Cerrado"}</span>
            <span className="input">
              <input
                type="time"
                aria-label={`Apertura del ${DIAS[i]}`}
                value={fila.abre}
                disabled={!fila.abierto}
                onChange={(e) => setFilas(filas.map((f, j) => (j === i ? { ...f, abre: e.target.value } : f)))}
              />
            </span>
            <span className="input">
              <input
                type="time"
                aria-label={`Cierre del ${DIAS[i]}`}
                value={fila.cierra}
                disabled={!fila.abierto}
                onChange={(e) => setFilas(filas.map((f, j) => (j === i ? { ...f, cierra: e.target.value } : f)))}
              />
            </span>
          </div>
        ))}
      </div>
      {Object.values(detalles).map((m) => (
        <FieldError key={m} message={m} />
      ))}
      {guardar.error && !Object.keys(detalles).length && <ErrorAlert error={guardar.error} />}
      {guardar.isSuccess && <p className="alert success">Horario guardado.</p>}
      <div className="form-actions">
        <button type="submit" disabled={guardar.isPending}>
          <Save className="icon" aria-hidden="true" />
          {guardar.isPending ? "Guardando…" : "Guardar horario"}
        </button>
      </div>
    </form>
  );
}

function PlazasDeZona({ zona }: { zona: Zona }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"regular" | "preferente">("regular");
  const [afectadas, setAfectadas] = useState<ReservaAfectada[]>([]);
  const plazas = useQuery({
    queryKey: ["admin", "plazas", zona.id],
    queryFn: () => api<{ plazas: Plaza[] }>(`/admin/plazas?zonaId=${zona.id}`),
  });
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "plazas"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "zonas"] });
  };

  const crear = useMutation({
    mutationFn: () => api("/admin/plazas", { method: "POST", body: { zonaId: zona.id, codigo, tipo } }),
    onSuccess: () => {
      setCodigo("");
      refrescar();
    },
  });
  const cambiar = useMutation({
    mutationFn: async ({ plaza, cambios, accion }: { plaza: Plaza; cambios: Partial<Plaza>; accion: string }) => {
      const { reservas } = await api<{ reservas: ReservaAfectada[] }>(`/admin/plazas/${plaza.id}/reservas-afectadas`);
      if (!confirmarAfectadas(accion, reservas)) return null;
      return api<{ reservasAfectadas: ReservaAfectada[] }>(`/admin/plazas/${plaza.id}`, { method: "PATCH", body: cambios });
    },
    onSuccess: (resultado) => {
      if (resultado) setAfectadas(resultado.reservasAfectadas);
      refrescar();
    },
  });
  const qr = useMutation({
    mutationFn: ({ plaza, revocar }: { plaza: Plaza; revocar: boolean }) =>
      api(`/admin/plazas/${plaza.id}/qr`, { method: revocar ? "DELETE" : "POST" }),
    onSuccess: refrescar,
  });
  const detallesCrear = crear.error instanceof ApiError ? crear.error.details : {};

  const onCrear = (event: FormEvent) => {
    event.preventDefault();
    crear.mutate();
  };

  return (
    <section className="card table-card" aria-labelledby="titulo-plazas">
      <div className="table-toolbar">
        <h2 id="titulo-plazas">Plazas de {zona.nombre}</h2>
        <form className="row-actions" onSubmit={onCrear} aria-label="Agregar plaza">
          <span className="input" style={{ width: 110 }}>
            <input placeholder="Código" aria-label="Código de la nueva plaza" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </span>
          <select aria-label="Tipo de la nueva plaza" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="regular">Regular</option>
            <option value="preferente">Preferente</option>
          </select>
          <button type="submit" disabled={crear.isPending || !codigo.trim()}>
            <Plus className="icon" aria-hidden="true" />
            Agregar
          </button>
        </form>
      </div>
      <div style={{ padding: "0 var(--space-5)" }}>
        <FieldError message={detallesCrear.codigo ?? detallesCrear.zonaId} />
      </div>
      <div style={{ padding: "var(--space-3) var(--space-5) 0", display: "grid", gap: "var(--space-3)" }}>
        <ErrorAlert error={!Object.keys(detallesCrear).length ? crear.error : null} />
        <ErrorAlert error={cambiar.error ?? qr.error} />
        <ReservasAfectadas reservas={afectadas} titulo="Reservas vigentes afectadas por el cambio" />
      </div>

      {plazas.isLoading && <p className="empty">Cargando plazas…</p>}
      <ErrorAlert error={plazas.error} onRetry={() => plazas.refetch()} />
      {plazas.data && plazas.data.plazas.length === 0 && <Empty icon={SquareParking}>Este bloque aún no tiene plazas.</Empty>}
      {plazas.data && plazas.data.plazas.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Plaza</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">QR</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plazas.data.plazas.map((plaza) => (
                <tr key={plaza.id}>
                  <td>
                    <strong>{plaza.codigo}</strong>
                  </td>
                  <td>
                    <select
                      className="compact"
                      aria-label={`Tipo de la plaza ${plaza.codigo}`}
                      value={plaza.tipo}
                      disabled={cambiar.isPending}
                      onChange={(e) =>
                        cambiar.mutate({
                          plaza,
                          cambios: { tipo: e.target.value as Plaza["tipo"] },
                          accion: `Cambiar la plaza ${plaza.codigo} a ${e.target.value}`,
                        })
                      }
                    >
                      <option value="regular">Regular</option>
                      <option value="preferente">Preferente</option>
                    </select>
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                      <span className={`badge ${plaza.activa ? "success" : "danger"}`}>{plaza.activa ? "Activa" : "Inactiva"}</span>
                      {plaza.bloqueada && <span className="badge warning">Bloqueada</span>}
                      {!plaza.bloqueada && plaza.bloqueos.length > 0 && <span className="badge warning">Bloqueo programado</span>}
                    </span>
                  </td>
                  <td>{plaza.qr ? <span className="badge accent">Vigente</span> : <span className="badge danger">Sin QR</span>}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary small"
                        disabled={qr.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Emitir un QR nuevo para ${plaza.codigo}? El impreso actual dejará de funcionar.`)) qr.mutate({ plaza, revocar: false });
                        }}
                      >
                        <QrCode className="icon" aria-hidden="true" />
                        {plaza.qr ? "Rotar QR" : "Emitir QR"}
                      </button>
                      {plaza.qr && (
                        <button
                          type="button"
                          className="ghost small"
                          disabled={qr.isPending}
                          onClick={() => {
                            if (window.confirm(`¿Revocar el QR de ${plaza.codigo}? No se podrá registrar llegada hasta emitir otro.`)) qr.mutate({ plaza, revocar: true });
                          }}
                        >
                          <Ban className="icon" aria-hidden="true" />
                          Revocar
                        </button>
                      )}
                      <button
                        type="button"
                        className={plaza.activa ? "danger small" : "secondary small"}
                        disabled={cambiar.isPending}
                        onClick={() =>
                          cambiar.mutate({
                            plaza,
                            cambios: { activa: !plaza.activa },
                            accion: `${plaza.activa ? "Desactivar" : "Activar"} la plaza ${plaza.codigo}`,
                          })
                        }
                      >
                        {plaza.activa ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Bloques, horarios, plazas y QR del inventario (02B). */
export function InventarioPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const zonas = useQuery({ queryKey: ["admin", "zonas"], queryFn: () => api<{ zonas: Zona[] }>("/admin/zonas") });
  const lista = zonas.data?.zonas ?? [];
  const seleccionada = lista.find((z) => z.id === Number(params.get("zona"))) ?? lista.find((z) => z.plazas.total > 0) ?? lista[0];

  const cambiarZona = useMutation({
    mutationFn: (zona: Zona) => api(`/admin/zonas/${zona.id}`, { method: "PATCH", body: { activa: !zona.activa } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "zonas"] }),
  });

  return (
    <>
      <PageHeader eyebrow="Inventario" title="Bloques y plazas" description="Habilita bloques, define su horario y administra plazas regulares y preferentes con su QR.">
        <button type="button" className="secondary" onClick={() => zonas.refetch()} disabled={zonas.isFetching}>
          <RefreshCw className="icon" aria-hidden="true" />
          Actualizar
        </button>
      </PageHeader>

      <ErrorAlert error={zonas.error ?? cambiarZona.error} onRetry={() => zonas.refetch()} />

      <section className="card table-card" aria-labelledby="titulo-bloques">
        <div className="table-toolbar">
          <h2 id="titulo-bloques">Bloques</h2>
          <span className="subtle">Un bloque inactivo no recibe nuevas reservas.</span>
        </div>
        {zonas.isLoading && <p className="empty">Cargando bloques…</p>}
        {zonas.data && lista.length === 0 && <Empty icon={Warehouse}>No hay bloques. Ejecuta «npm run db:seed» para cargar el catálogo.</Empty>}
        {lista.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Bloque</th>
                  <th scope="col">Plazas</th>
                  <th scope="col">Horario</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((zona) => (
                  <tr
                    key={zona.id}
                    className={`clickable ${zona.id === seleccionada?.id ? "selected" : ""}`}
                    onClick={() => setParams({ zona: String(zona.id) })}
                  >
                    <td>
                      <button type="button" className="ghost small" style={{ color: "var(--text)", padding: 0 }} aria-current={zona.id === seleccionada?.id}>
                        {zona.nombre}
                      </button>
                      <div className="subtle">{zona.idOrigen ?? "Creado en el panel"}</div>
                    </td>
                    <td>
                      {zona.plazas.activas}/{zona.plazas.total}
                      {zona.plazas.preferentes > 0 && <span className="subtle"> · {zona.plazas.preferentes} pref.</span>}
                    </td>
                    <td className="muted">{resumenHorario(zona.horarios)}</td>
                    <td>
                      <span className={`badge ${zona.activa ? "success" : "danger"}`}>{zona.activa ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="secondary small"
                          disabled={cambiarZona.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`¿${zona.activa ? "Desactivar" : "Activar"} ${zona.nombre}?`)) cambiarZona.mutate(zona);
                          }}
                        >
                          {zona.activa ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {seleccionada && (
        <div className="split">
          <PlazasDeZona zona={seleccionada} />
          <EditorHorario zona={seleccionada} />
        </div>
      )}
    </>
  );
}
