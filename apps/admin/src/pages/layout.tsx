import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router";
import { useSession } from "../session";

/** Estructura de las páginas con sesión de administración. Sin sesión, redirige al inicio de sesión. */
export function AdminLayout() {
  const { sesion, cerrar } = useSession();
  const [saliendo, setSaliendo] = useState(false);

  if (!sesion) {
    return <Navigate to="/ingresar" replace />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Campus San Joaquín</p>
          <strong>MiEstacionamientoUC · Administración</strong>
        </div>
        <nav aria-label="Secciones">
          <NavLink to="/" end>
            Cuentas
          </NavLink>
          <NavLink to="/diagnostico">Diagnóstico</NavLink>
        </nav>
        <div className="session">
          <span className="muted">{sesion.cuenta.correo}</span>
          <button
            type="button"
            className="secondary"
            disabled={saliendo}
            onClick={async () => {
              setSaliendo(true);
              await cerrar();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
