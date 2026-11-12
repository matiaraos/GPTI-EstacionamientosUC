import { Activity, LogOut, QrCode, Users } from "lucide-react";
import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router";
import { useSession } from "../session";

const secciones = [
  { to: "/", label: "Cuentas", icon: Users, end: true },
  { to: "/codigos-qr", label: "Códigos QR", icon: QrCode, end: false },
  { to: "/diagnostico", label: "Diagnóstico", icon: Activity, end: false },
];

/** Estructura de las páginas con sesión de administración. Sin sesión, redirige al inicio de sesión. */
export function AdminLayout() {
  const { sesion, cerrar } = useSession();
  const [saliendo, setSaliendo] = useState(false);

  if (!sesion) {
    return <Navigate to="/ingresar" replace />;
  }

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div>
            <div className="brand-name">MiEstacionamientoUC</div>
            <div className="subtle">Administración</div>
          </div>
        </div>
        <nav className="nav" aria-label="Secciones">
          {secciones.map(({ to, label, icon: Icono, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icono className="icon" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user">
            <span className="avatar" aria-hidden="true">
              {sesion.cuenta.correo.charAt(0).toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontWeight: 600 }} title={sesion.cuenta.correo}>
                {sesion.cuenta.correo}
              </div>
              <div className="subtle">Campus San Joaquín</div>
            </div>
          </div>
          <button
            type="button"
            className="ghost"
            disabled={saliendo}
            onClick={async () => {
              setSaliendo(true);
              await cerrar();
            }}
          >
            <LogOut className="icon" aria-hidden="true" />
            {saliendo ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
