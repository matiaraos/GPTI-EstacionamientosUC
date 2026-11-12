import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import type { Destino } from "@/api/catalogo";
import type { BloqueImportado, BloqueUCPropuesto } from "@/api/horario";

/** Bloque en edición: día, horas de pared de Santiago y destino. */
export type BorradorBloque = { id: number | null; diaSemana: number; inicio: string; fin: string; titulo: string; destino: Destino | null; uc?: boolean };

type HorarioValue = {
  borrador: BorradorBloque;
  editar: (bloque: BorradorBloque) => void;
  actualizarBorrador: (cambios: Partial<BorradorBloque>) => void;
  /** Bloques propuestos por la importación, pendientes de revisar. */
  importados: BloqueImportado[] | null;
  fijarImportados: (bloques: BloqueImportado[] | null) => void;
  /** Vista previa del horario UC, pendiente de confirmar. */
  vistaUC: BloqueUCPropuesto[] | null;
  fijarVistaUC: (bloques: BloqueUCPropuesto[] | null) => void;
  actualizarBloqueUC: (indice: number, cambios: Partial<BloqueUCPropuesto>) => void;
  /** A qué se aplica el destino elegido en el buscador: el borrador, un bloque importado o uno del horario UC. */
  objetivo: Objetivo;
  elegirPara: (objetivo: Objetivo) => void;
  aplicarDestino: (destino: Destino) => void;
};

export const borradorVacio = (): BorradorBloque => ({ id: null, diaSemana: 1, inicio: "08:30", fin: "09:50", titulo: "", destino: null });

type Objetivo = "borrador" | number | { uc: number };

const HorarioContext = createContext<HorarioValue | null>(null);

/** Estado compartido entre el horario, el editor de bloques, el buscador de destinos y la importación. */
export function HorarioProvider({ children }: { children: ReactNode }) {
  const [borrador, setBorrador] = useState<BorradorBloque>(borradorVacio);
  const [importados, setImportados] = useState<BloqueImportado[] | null>(null);
  const [objetivo, setObjetivo] = useState<Objetivo>("borrador");
  const [vistaUC, setVistaUC] = useState<BloqueUCPropuesto[] | null>(null);
  const actualizarBloqueUC = useCallback(
    (indice: number, cambios: Partial<BloqueUCPropuesto>) =>
      setVistaUC((lista) => lista?.map((b, i) => (i === indice ? { ...b, ...cambios } : b)) ?? null),
    [],
  );

  const aplicarDestino = useCallback(
    (destino: Destino) => {
      if (typeof objetivo === "object") {
        // Elegir el destino resuelve el problema de sala y deja el bloque incluido.
        actualizarBloqueUC(objetivo.uc, { destino, incluir: true, problemas: [] });
      } else if (objetivo === "borrador") {
        setBorrador((b) => ({ ...b, destino }));
      } else {
        setImportados((lista) =>
          lista?.map((b, i) =>
            i === objetivo ? { ...b, destino, problemas: b.problemas.filter((p) => !p.includes("destino") && !p.includes("elige uno")) } : b,
          ) ?? null,
        );
      }
    },
    [objetivo, actualizarBloqueUC],
  );

  const value = useMemo<HorarioValue>(
    () => ({
      borrador,
      editar: setBorrador,
      actualizarBorrador: (cambios) => setBorrador((b) => ({ ...b, ...cambios })),
      importados,
      fijarImportados: setImportados,
      vistaUC,
      fijarVistaUC: setVistaUC,
      actualizarBloqueUC,
      objetivo,
      elegirPara: setObjetivo,
      aplicarDestino,
    }),
    [borrador, importados, objetivo, aplicarDestino, vistaUC, actualizarBloqueUC],
  );
  return <HorarioContext value={value}>{children}</HorarioContext>;
}

export function useHorario() {
  const value = use(HorarioContext);
  if (!value) throw new Error("useHorario debe usarse dentro de HorarioProvider.");
  return value;
}
