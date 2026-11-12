import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accessibility, BadgeCheck, ShieldOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, type Cuenta } from "../api";
import { Empty, ErrorAlert, FieldError, formatoFecha, formatoFechaHora, PageHeader, useApi } from "../ui";

type Autorizacion = {
  cuenta: { id: number; correo: string };
  vigenteHasta: string;
  revocadaEn: string | null;
  otorgadaEn: string;
  otorgadaPor: string;
  estado: "vigente" | "vencida" | "revocada";
};

const ESTADOS = {
  vigente: { clase: "success", texto: "Vigente" },
  vencida: { clase: "warning", texto: "Vencida" },
  revocada: { clase: "danger", texto: "Revocada" },
} as const;

/** El último día de vigencia se muestra como fecha local (la API guarda el inicio del día siguiente). */
const ultimoDia = (vigenteHasta: string) => formatoFecha(new Date(new Date(vigenteHasta).getTime() - 1));

/** Habilitaciones para plazas preferentes (SC-002): solo estado administrativo y vigencia. */
export function AutorizacionesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [cuentaId, setCuentaId] = useState("");
  const [vigenteHasta, setVigenteHasta] = useState("");

  const cuentas = useQuery({ queryKey: ["admin", "cuentas"], queryFn: () => api<{ cuentas: Cuenta[] }>("/admin/cuentas") });
  const autorizaciones = useQuery({
    queryKey: ["admin", "autorizaciones"],
    queryFn: () => api<{ autorizaciones: Autorizacion[] }>("/admin/autorizaciones"),
  });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["admin", "autorizaciones"] });

  const otorgar = useMutation({
    mutationFn: () => {
      if (!cuentaId) throw new ApiError(400, "datos_invalidos", "Elige la cuenta.", { cuentaId: "Elige la cuenta." });
      return api(`/admin/cuentas/${cuentaId}/autorizacion`, { method: "PUT", body: { vigenteHasta } });
    },
    onSuccess: () => {
      setCuentaId("");
      void refrescar();
    },
  });
  const revocar = useMutation({
    mutationFn: (id: number) => api(`/admin/cuentas/${id}/autorizacion/revocar`, { method: "POST" }),
    onSuccess: refrescar,
  });
  const detalles = otorgar.error instanceof ApiError ? otorgar.error.details : {};
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    otorgar.mutate();
  };

  const usuarios = (cuentas.data?.cuentas ?? []).filter((c) => c.rol === "usuario" && c.activa !== false);
  const lista = autorizaciones.data?.autorizaciones ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Accesibilidad"
        title="Habilitaciones preferentes"
        description="Cuentas que pueden optar a plazas preferentes. Se registra solo el estado y la vigencia: no se solicitan certificados ni motivos médicos."
      />

      <form className="card form-card" onSubmit={onSubmit} noValidate>
        <h2>Otorgar o renovar</h2>
        <div className="form-grid">
          <label className="field">
            Cuenta
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Elige una cuenta</option>
              {usuarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.correo}
                </option>
              ))}
            </select>
            <FieldError message={detalles.cuentaId} />
          </label>
          <label className="field">
            Vigente hasta (inclusive)
            <span className="input">
              <input type="date" value={vigenteHasta} onChange={(e) => setVigenteHasta(e.target.value)} />
            </span>
            <FieldError message={detalles.vigenteHasta} />
          </label>
        </div>
        <ErrorAlert error={!Object.keys(detalles).length ? otorgar.error : null} />
        {otorgar.isSuccess && <p className="alert success">Habilitación registrada.</p>}
        <div className="form-actions">
          <button type="submit" disabled={otorgar.isPending}>
            <BadgeCheck className="icon" aria-hidden="true" />
            {otorgar.isPending ? "Guardando…" : "Guardar habilitación"}
          </button>
        </div>
      </form>

      <section className="card table-card" aria-labelledby="titulo-autorizaciones">
        <div className="table-toolbar">
          <h2 id="titulo-autorizaciones">Habilitaciones</h2>
          <span className="subtle">Una habilitación vencida o revocada deja de ser válida al asignar.</span>
        </div>
        <ErrorAlert error={autorizaciones.error ?? revocar.error} onRetry={() => autorizaciones.refetch()} />
        {autorizaciones.isLoading && <p className="empty">Cargando…</p>}
        {autorizaciones.data && lista.length === 0 && <Empty icon={Accessibility}>Aún no hay habilitaciones registradas.</Empty>}
        {lista.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Vigente hasta</th>
                  <th scope="col">Otorgada</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.cuenta.id}>
                    <td>{a.cuenta.correo}</td>
                    <td>
                      <span className={`badge ${ESTADOS[a.estado].clase}`}>{ESTADOS[a.estado].texto}</span>
                    </td>
                    <td>{ultimoDia(a.vigenteHasta)}</td>
                    <td className="muted">
                      {formatoFechaHora(a.otorgadaEn)} · {a.otorgadaPor}
                    </td>
                    <td>
                      {a.estado === "vigente" && (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="danger small"
                            disabled={revocar.isPending}
                            onClick={() => {
                              if (window.confirm(`¿Revocar la habilitación de ${a.cuenta.correo}?`)) revocar.mutate(a.cuenta.id);
                            }}
                          >
                            <ShieldOff className="icon" aria-hidden="true" />
                            Revocar
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
