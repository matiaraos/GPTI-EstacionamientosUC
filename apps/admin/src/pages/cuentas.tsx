import { useQuery } from "@tanstack/react-query";
import { Car, CircleAlert, RefreshCw, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { apiRequest, type Cuenta } from "../api";
import { useSession } from "../session";

const fecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" });

function Indicador({ icon: Icono, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="card stat">
      <span className="stat-icon" aria-hidden="true">
        <Icono className="icon" />
      </span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="muted">{label}</div>
      </div>
    </div>
  );
}

export function CuentasPage() {
  const { sesion } = useSession();
  const [filtro, setFiltro] = useState("");
  const cuentas = useQuery({
    queryKey: ["admin", "cuentas"],
    queryFn: () => apiRequest<{ cuentas: Cuenta[] }>("/admin/cuentas", { token: sesion?.token }),
  });

  const todas = cuentas.data?.cuentas ?? [];
  const texto = filtro.trim().toLowerCase();
  const visibles = texto
    ? todas.filter(
        (cuenta) =>
          cuenta.correo.includes(texto) || cuenta.vehiculos.some((vehiculo) => vehiculo.patente.toLowerCase().includes(texto)),
      )
    : todas;
  const administradores = todas.filter((cuenta) => cuenta.rol === "admin").length;
  const patentes = todas.reduce((total, cuenta) => total + cuenta.vehiculos.length, 0);

  return (
    <>
      <header className="page-header">
        <div className="stack">
          <p className="eyebrow">Comunidad</p>
          <h1>Cuentas</h1>
          <p className="muted">Personas registradas en la app y administradores del panel.</p>
        </div>
        <button type="button" className="secondary" onClick={() => cuentas.refetch()} disabled={cuentas.isFetching}>
          <RefreshCw className="icon" aria-hidden="true" />
          Actualizar
        </button>
      </header>

      <section className="stats" aria-label="Resumen">
        <Indicador icon={Users} label="Cuentas" value={todas.length} />
        <Indicador icon={UserRound} label="Usuarios" value={todas.length - administradores} />
        <Indicador icon={ShieldCheck} label="Administradores" value={administradores} />
        <Indicador icon={Car} label="Patentes registradas" value={patentes} />
      </section>

      <section className="card table-card" aria-labelledby="titulo-cuentas">
        <div className="table-toolbar">
          <h2 id="titulo-cuentas">Listado</h2>
          <label className="input">
            <Search className="icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por correo o patente"
              aria-label="Buscar por correo o patente"
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
            />
          </label>
        </div>

        {cuentas.isLoading && <p className="empty">Cargando cuentas…</p>}

        {cuentas.error && (
          <div className="empty" role="alert">
            <span className="stat-icon" style={{ background: "var(--danger-soft)", color: "var(--danger)" }} aria-hidden="true">
              <CircleAlert className="icon" />
            </span>
            <p>{cuentas.error.message}</p>
            <button type="button" className="secondary" onClick={() => cuentas.refetch()}>
              Reintentar
            </button>
          </div>
        )}

        {cuentas.data && visibles.length === 0 && (
          <div className="empty">
            <span className="stat-icon" aria-hidden="true">
              <Search className="icon" />
            </span>
            <p>{texto ? `Ninguna cuenta coincide con «${filtro}».` : "Aún no hay cuentas registradas."}</p>
          </div>
        )}

        {visibles.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Patentes</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Registro</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((cuenta) => (
                  <tr key={cuenta.id}>
                    <td>
                      <div className="user">
                        <span className="avatar" aria-hidden="true">
                          {cuenta.correo.charAt(0).toUpperCase()}
                        </span>
                        <span>{cuenta.correo}</span>
                      </div>
                    </td>
                    <td>
                      {cuenta.rol === "admin" ? (
                        <span className="badge accent">
                          <ShieldCheck size={14} aria-hidden="true" />
                          Administración
                        </span>
                      ) : (
                        <span className="badge">Usuario</span>
                      )}
                    </td>
                    <td>
                      {cuenta.vehiculos.length > 0 ? (
                        <span style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                          {cuenta.vehiculos.map((vehiculo) => (
                            <span key={vehiculo.id} className="plate">
                              {vehiculo.patente}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${cuenta.activa ? "success" : "danger"}`}>{cuenta.activa ? "Activa" : "Desactivada"}</span>
                    </td>
                    <td className="muted">{cuenta.creadaEn ? fecha.format(new Date(cuenta.creadaEn)) : "—"}</td>
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
