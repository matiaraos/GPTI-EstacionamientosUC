import { useQuery } from "@tanstack/react-query";
import { apiRequest, type Cuenta } from "../api";
import { useSession } from "../session";

const fecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" });

export function CuentasPage() {
  const { sesion } = useSession();
  const cuentas = useQuery({
    queryKey: ["admin", "cuentas"],
    queryFn: () => apiRequest<{ cuentas: Cuenta[] }>("/admin/cuentas", { token: sesion?.token }),
  });

  return (
    <section className="stack">
      <h1>Cuentas</h1>
      {cuentas.isLoading && <p className="muted">Cargando cuentas…</p>}
      {cuentas.error && (
        <div role="alert" className="alert">
          <p>{cuentas.error.message}</p>
          <button type="button" className="secondary" onClick={() => cuentas.refetch()}>
            Reintentar
          </button>
        </div>
      )}
      {cuentas.data && cuentas.data.cuentas.length === 0 && <p className="muted">Aún no hay cuentas registradas.</p>}
      {cuentas.data && cuentas.data.cuentas.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">Correo</th>
              <th scope="col">Rol</th>
              <th scope="col">Patentes</th>
              <th scope="col">Estado</th>
              <th scope="col">Registro</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.data.cuentas.map((cuenta) => (
              <tr key={cuenta.id}>
                <td>{cuenta.correo}</td>
                <td>{cuenta.rol === "admin" ? "Administración" : "Usuario"}</td>
                <td>{cuenta.vehiculos.map((vehiculo) => vehiculo.patente).join(", ") || "—"}</td>
                <td>{cuenta.activa ? "Activa" : "Desactivada"}</td>
                <td>{cuenta.creadaEn ? fecha.format(new Date(cuenta.creadaEn)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
