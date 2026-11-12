import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import type { Destino } from "@/api/catalogo";
import type { BloqueImportado } from "@/api/horario";

/** Bloque en edición: día, horas de pared de Santiago y destino. */
export type BorradorBloque = { id: number | null; diaSemana: number; inicio: string; fin: string; titulo: string; destino: Destino | null };

type HorarioValue = {
  borrador: BorradorBloque;
  editar: (bloque: BorradorBloque) => void;
  actualizarBorrador: (cambios: Partial<BorradorBloque>) => void;
  /** Bloques propuestos por la importación, pendientes de revisar. */
  importados: BloqueImportado[] | null;
  fijarImportados: (bloques: BloqueImportado[] | null) => void;
  /** A qué se aplica el destino elegido en el buscador: el borrador o un bloque importado. */
  objetivo: "borrador" | number;
  elegirPara: (objetivo: "borrador" | number) => void;
  aplicarDestino: (destino: Destino) => void;
};

export const borradorVacio = (): BorradorBloque => ({ id: null, diaSemana: 1, inicio: "08:30", fin: "09:50", titulo: "", destino: null });

const HorarioContext = createContext<HorarioValue | null>(null);

/** Estado compartido entre el horario, el editor de bloques, el buscador de destinos y la importación. */
export function HorarioProvider({ children }: { children: ReactNode }) {
  const [borrador, setBorrador] = useState<BorradorBloque>(borradorVacio);
  const [importados, setImportados] = useState<BloqueImportado[] | null>(null);
  const [objetivo, setObjetivo] = useState<"borrador" | number>("borrador");

  const aplicarDestino = useCallback(
    (destino: Destino) => {
      if (objetivo === "borrador") {
        setBorrador((b) => ({ ...b, destino }));
      } else {
        setImportados((lista) =>
          lista?.map((b, i) =>
            i === objetivo ? { ...b, destino, problemas: b.problemas.filter((p) => !p.includes("destino") && !p.includes("elige uno")) } : b,
          ) ?? null,
        );
      }
    },
    [objetivo],
  );

  const value = useMemo<HorarioValue>(
    () => ({
      borrador,
      editar: setBorrador,
      actualizarBorrador: (cambios) => setBorrador((b) => ({ ...b, ...cambios })),
      importados,
      fijarImportados: setImportados,
      objetivo,
      elegirPara: setObjetivo,
      aplicarDestino,
    }),
    [borrador, importados, objetivo, aplicarDestino],
  );
  return <HorarioContext value={value}>{children}</HorarioContext>;
}

export function useHorario() {
  const value = use(HorarioContext);
  if (!value) throw new Error("useHorario debe usarse dentro de HorarioProvider.");
  return value;
}
