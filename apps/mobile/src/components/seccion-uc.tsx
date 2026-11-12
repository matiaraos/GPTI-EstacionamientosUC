import type { ReactNode } from "react";
import type { SeccionUC } from "@/api/horario";
import { ListRow, Section } from "./section";

/** Sección de un curso UC como en Buscacursos: sigla, sección, NRC y cada actividad con módulos y sala. */
export function SeccionUCCard({ seccion, footer, children }: { seccion: SeccionUC; footer?: string; children?: ReactNode }) {
  return (
    <Section title={`${seccion.sigla}-${seccion.seccion} · NRC ${seccion.nrc}`} footer={footer}>
      <ListRow icon="calendar" title={seccion.nombre} detail={`${seccion.creditos} créditos · ${seccion.semestre}`} />
      {seccion.actividades.map((a) => (
        <ListRow
          key={a.id}
          icon={a.tipo === "LAB" ? "qr" : a.tipo === "AYU" ? "person" : "room"}
          title={`${a.tipoNombre} · ${a.modulos}`}
          detail={`${a.horas} · ${a.sala ?? "Sin sala"}${a.sala && !a.destino ? " (fuera del catálogo)" : ""}`}
        />
      ))}
      {children}
    </Section>
  );
}
