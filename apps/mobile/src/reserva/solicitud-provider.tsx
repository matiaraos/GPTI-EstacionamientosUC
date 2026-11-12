import { createContext, use, useMemo, useState, type ReactNode } from "react";
import type { Destino } from "@/api/catalogo";
import { ahoraEnSantiago, proximoCuartoDeHora, sumarHoras } from "@/lib/tiempo";

export type Solicitud = {
  fecha: string;
  llegada: string;
  salida: string;
  destino: Destino | null;
};

type SolicitudValue = Solicitud & {
  actualizar: (cambios: Partial<Solicitud>) => void;
  reiniciar: () => void;
};

function inicial(): Solicitud {
  const { fecha, hora } = ahoraEnSantiago();
  const llegada = proximoCuartoDeHora(hora);
  return { fecha, llegada, salida: sumarHoras(llegada, 4, "23:45"), destino: null };
}

const SolicitudContext = createContext<SolicitudValue | null>(null);

/**
 * Borrador de la solicitud de reserva. Vive mientras la sesión está abierta, de modo que los datos
 * ingresados se conservan al elegir el destino o si la API rechaza la solicitud.
 */
export function SolicitudProvider({ children }: { children: ReactNode }) {
  const [solicitud, setSolicitud] = useState<Solicitud>(inicial);
  const value = useMemo<SolicitudValue>(
    () => ({
      ...solicitud,
      actualizar: (cambios) => setSolicitud((actual) => ({ ...actual, ...cambios })),
      reiniciar: () => setSolicitud(inicial()),
    }),
    [solicitud],
  );
  return <SolicitudContext value={value}>{children}</SolicitudContext>;
}

export function useSolicitud() {
  const value = use(SolicitudContext);
  if (!value) {
    throw new Error("useSolicitud debe usarse dentro de SolicitudProvider.");
  }
  return value;
}
