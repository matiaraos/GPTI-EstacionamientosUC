import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { useSession } from "../session";

type PlazaQr = {
  id: number;
  codigo: string;
  tipo: "regular" | "preferente";
  activa: boolean;
  zona: { id: number; nombre: string; idOrigen: string | null };
  qr: string | null;
};

function Codigo({ contenido, etiqueta }: { contenido: string; etiqueta: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    QRCode.toDataURL(contenido, { margin: 1, width: 336, errorCorrectionLevel: "M", color: { dark: "#0e1726", light: "#ffffff" } }).then(
      (url) => {
        if (vigente) setSrc(url);
      },
    );
    return () => {
      vigente = false;
    };
  }, [contenido]);
  return src ? <img src={src} alt={`Código QR de ${etiqueta}`} width={168} height={168} /> : <div className="qr-placeholder" />;
}

/** Hoja imprimible con el QR vigente de cada plaza, agrupada por bloque. */
export function CodigosQrPage() {
  const { sesion } = useSession();
  const plazas = useQuery({
    queryKey: ["admin", "plazas"],
    queryFn: () => apiRequest<{ plazas: PlazaQr[] }>("/admin/plazas", { token: sesion?.token }),
  });

  const porZona = new Map<string, PlazaQr[]>();
  for (const plaza of plazas.data?.plazas ?? []) {
    porZona.set(plaza.zona.nombre, [...(porZona.get(plaza.zona.nombre) ?? []), plaza]);
  }

  return (
    <>
      <header className="page-header no-print">
        <div className="stack">
          <p className="eyebrow">Inventario</p>
          <h1>Códigos QR de las plazas</h1>
          <p className="muted">Pega cada código en su plaza. Si la cámara no lo lee, la app permite escribir el texto bajo el QR.</p>
        </div>
        <button type="button" onClick={() => window.print()} disabled={!plazas.data}>
          <Printer className="icon" aria-hidden="true" />
          Imprimir
        </button>
      </header>

      {plazas.isLoading && <p className="muted">Cargando plazas…</p>}
      {plazas.error && (
        <div role="alert" className="alert">
          <CircleAlert className="icon" aria-hidden="true" />
          <span style={{ flex: 1 }}>{plazas.error.message}</span>
          <button type="button" className="secondary" onClick={() => plazas.refetch()}>
            Reintentar
          </button>
        </div>
      )}
      {plazas.data && plazas.data.plazas.length === 0 && (
        <div className="card empty">
          <span className="stat-icon" aria-hidden="true">
            <QrCode className="icon" />
          </span>
          <p>No hay plazas cargadas. Ejecuta «npm run db:seed» para crear las de la demo.</p>
        </div>
      )}

      {[...porZona.entries()].map(([zona, lista]) => (
        <section key={zona} className="qr-zona" aria-label={zona}>
          <h2>
            {zona} <span className="subtle">· {lista.length} plazas</span>
          </h2>
          <div className="qr-grid">
            {lista.map((plaza) => (
              <article key={plaza.id} className="card qr-card">
                <header>
                  <span className="brand-mark" aria-hidden="true">
                    P
                  </span>
                  MiEstacionamientoUC
                </header>
                <span className="eyebrow">Plaza</span>
                <strong className="qr-plaza">{plaza.codigo}</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {plaza.zona.nombre}
                </span>
                {plaza.qr ? (
                  <>
                    <Codigo contenido={plaza.qr} etiqueta={`la plaza ${plaza.codigo}`} />
                    <code>{plaza.qr}</code>
                  </>
                ) : (
                  <span className="badge danger">Sin QR vigente</span>
                )}
                {!plaza.activa && <span className="badge danger">Plaza inactiva</span>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
