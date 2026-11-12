import { useQuery } from "@tanstack/react-query";
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
    QRCode.toDataURL(contenido, { margin: 1, width: 320, errorCorrectionLevel: "M" }).then((url) => {
      if (vigente) setSrc(url);
    });
    return () => {
      vigente = false;
    };
  }, [contenido]);
  return src ? <img src={src} alt={`Código QR de ${etiqueta}`} width={160} height={160} /> : <div className="qr-placeholder" />;
}

/** Hoja imprimible con el QR vigente de cada plaza y el código para ingresarlo a mano. */
export function CodigosQrPage() {
  const { sesion } = useSession();
  const plazas = useQuery({
    queryKey: ["admin", "plazas"],
    queryFn: () => apiRequest<{ plazas: PlazaQr[] }>("/admin/plazas", { token: sesion?.token }),
  });

  return (
    <section className="stack">
      <div className="toolbar">
        <h1>Códigos QR de las plazas</h1>
        <button type="button" onClick={() => window.print()} disabled={!plazas.data}>
          Imprimir
        </button>
      </div>
      <p className="muted no-print">
        Pega cada código en su plaza. Si la cámara no lo lee, la app permite escribir el texto que aparece bajo el código.
      </p>
      {plazas.isLoading && <p className="muted">Cargando plazas…</p>}
      {plazas.error && (
        <div role="alert" className="alert">
          <p>{plazas.error.message}</p>
          <button type="button" className="secondary" onClick={() => plazas.refetch()}>
            Reintentar
          </button>
        </div>
      )}
      {plazas.data && plazas.data.plazas.length === 0 && (
        <p className="muted">No hay plazas cargadas. Ejecuta `npm run db:seed` para crear las de la demo.</p>
      )}
      <div className="qr-grid">
        {plazas.data?.plazas.map((plaza) => (
          <article key={plaza.id} className="qr-card">
            <p className="eyebrow">{plaza.zona.nombre}</p>
            <strong className="qr-plaza">Plaza {plaza.codigo}</strong>
            {plaza.qr ? (
              <>
                <Codigo contenido={plaza.qr} etiqueta={`la plaza ${plaza.codigo}`} />
                <code>{plaza.qr}</code>
              </>
            ) : (
              <p className="muted">Sin QR vigente.</p>
            )}
            {!plaza.activa && <p className="alert">Plaza inactiva</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
