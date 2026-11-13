import { createContext, use, useMemo, useState, type ReactNode } from "react";
import type { Destino } from "@/api/catalogo";

export type BorradorSerie = { dias: number[]; llegada: string; salida: string; destino: Destino | null };

type SerieValue = BorradorSerie & { actualizar: (cambios: Partial<BorradorSerie>) => void; reiniciar: () => void };

const inicial = (): BorradorSerie => ({ dias: [1, 3], llegada: "08:15", salida: "13:30", destino: null });
const SerieContext = createContext<SerieValue | null>(null);

/** Borrador de una reserva semanal; se conserva al elegir el destino o si la API la rechaza. */
export function SerieProvider({ children }: { children: ReactNode }) {
  const [borrador, setBorrador] = useState<BorradorSerie>(inicial);
  const value = useMemo<SerieValue>(
    () => ({ ...borrador, actualizar: (c) => setBorrador((b) => ({ ...b, ...c })), reiniciar: () => setBorrador(inicial()) }),
    [borrador],
  );
  return <SerieContext value={value}>{children}</SerieContext>;
}

export function useSerie() {
  const value = use(SerieContext);
  if (!value) throw new Error("useSerie debe usarse dentro de SerieProvider.");
  return value;
}
