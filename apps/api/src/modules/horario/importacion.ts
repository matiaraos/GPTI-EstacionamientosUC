import ical from "node-ical";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { partesLocales } from "../../lib/tiempo.js";
import { aHora } from "./bloques.js";

type DestinoCoincidente = { id: number; idOrigen: string; nombre: string; tipo: "sala" | "edificio"; pisos: number[] };

/** Bloque propuesto a partir del archivo. No se guarda hasta que la persona lo confirma. */
export type BloqueImportado = {
  diaSemana: number;
  inicio: string;
  fin: string;
  titulo: string | null;
  ubicacion: string | null;
  /** Destino elegido automáticamente cuando hay exactamente una coincidencia. */
  destino: DestinoCoincidente | null;
  coincidencias: DestinoCoincidente[];
  /** Motivos por los que el bloque requiere corrección antes de guardarlo. */
  problemas: string[];
};

const DIA_RRULE: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };

function texto(valor: unknown): string | null {
  const v = typeof valor === "string" ? valor : (valor as { val?: unknown } | undefined)?.val;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Días de la semana de una regla semanal (`BYDAY`), en cualquiera de las formas que entrega rrule. */
function diasDeRegla(regla: unknown): number[] {
  const opciones = (regla as { options?: { freq?: number; byweekday?: unknown } } | undefined)?.options;
  const byweekday = opciones?.byweekday;
  if (!Array.isArray(byweekday)) return [];
  return byweekday
    .map((d) => {
      if (typeof d === "string") return DIA_RRULE[d.slice(-2).toUpperCase()];
      if (typeof d === "number") return d + 1;
      const w = (d as { weekday?: number })?.weekday;
      return typeof w === "number" ? w + 1 : undefined;
    })
    .filter((d): d is number => typeof d === "number" && d >= 1 && d <= 7);
}

export async function buscarCoincidencias(db: Database, ubicacion: string): Promise<DestinoCoincidente[]> {
  const exactas = await db.$queryRaw<DestinoCoincidente[]>`
    SELECT "id", "idOrigen", "nombre", "tipo", "pisos" FROM "Destino"
    WHERE "activo" AND (upper("idOrigen") = upper(${ubicacion}) OR upper("idOrigen") LIKE upper(${ubicacion}) || '-%' OR lower("nombre") = lower(${ubicacion}))
    ORDER BY "idOrigen" LIMIT 6`;
  if (exactas.length > 0) return exactas;
  // Ubicaciones como «Sala ED113 - San Joaquín»: se prueba con los códigos que contienen.
  const codigos = [...new Set(ubicacion.toUpperCase().match(/\b[A-Z]{1,4}-?\d{1,4}[A-Z]?\b/g) ?? [])];
  for (const codigo of codigos) {
    const porCodigo = await db.$queryRaw<DestinoCoincidente[]>`
      SELECT "id", "idOrigen", "nombre", "tipo", "pisos" FROM "Destino"
      WHERE "activo" AND (upper("idOrigen") = ${codigo} OR upper("idOrigen") LIKE ${codigo} || '-%')
      ORDER BY "idOrigen" LIMIT 6`;
    if (porCodigo.length > 0) return porCodigo;
  }
  return [];
}

const ilegible = () =>
  new HttpError(400, "archivo_ilegible", "No pudimos leer el archivo. Exporta tu horario como calendario .ics e inténtalo de nuevo.");

/**
 * Convierte un calendario `.ics` en bloques semanales para revisar. Las horas se interpretan en
 * Santiago. Un evento semanal con `BYDAY` produce un bloque por día; los repetidos se agrupan.
 */
export async function previsualizarIcs(db: Database, contenido: string): Promise<{ bloques: BloqueImportado[]; omitidos: string[] }> {
  if (!/BEGIN:VCALENDAR/i.test(contenido)) {
    throw ilegible();
  }
  let datos: ReturnType<typeof ical.sync.parseICS>;
  try {
    datos = ical.sync.parseICS(contenido);
  } catch {
    throw ilegible();
  }
  const eventos = Object.values(datos).filter((c) => c?.type === "VEVENT") as ical.VEvent[];
  if (eventos.length === 0) {
    throw ilegible();
  }

  const omitidos: string[] = [];
  const vistos = new Map<string, BloqueImportado>();
  const cache = new Map<string, DestinoCoincidente[]>();

  for (const evento of eventos) {
    const titulo = texto(evento.summary);
    const nombre = titulo ?? "Evento sin título";
    if (evento.datetype === "date" || !(evento.start instanceof Date) || !(evento.end instanceof Date)) {
      omitidos.push(`${nombre}: no tiene hora de inicio y término.`);
      continue;
    }
    const inicio = partesLocales(evento.start);
    const fin = partesLocales(evento.end);
    if (fin.fecha !== inicio.fecha) {
      omitidos.push(`${nombre}: termina otro día.`);
      continue;
    }
    const regla = evento.rrule;
    const dias = regla && diasDeRegla(regla).length > 0 ? diasDeRegla(regla) : [inicio.diaSemana];
    const ubicacion = texto(evento.location);
    let coincidencias: DestinoCoincidente[] = [];
    if (ubicacion) {
      coincidencias = cache.get(ubicacion) ?? (await buscarCoincidencias(db, ubicacion));
      cache.set(ubicacion, coincidencias);
    }
    for (const diaSemana of dias) {
      const clave = `${diaSemana}|${inicio.hora}|${fin.hora}|${ubicacion ?? ""}`;
      if (vistos.has(clave)) continue;
      const problemas: string[] = [];
      if (!ubicacion) problemas.push("El evento no indica sala: elige el destino.");
      else if (coincidencias.length === 0) problemas.push(`«${ubicacion}» no está en el catálogo: elige el destino.`);
      else if (coincidencias.length > 1) problemas.push(`«${ubicacion}» coincide con ${coincidencias.length} destinos: elige uno.`);
      vistos.set(clave, {
        diaSemana,
        inicio: inicio.hora,
        fin: fin.minutoDelDia === 0 ? aHora(1440) : fin.hora,
        titulo,
        ubicacion,
        destino: coincidencias.length === 1 ? coincidencias[0] : null,
        coincidencias,
        problemas,
      });
    }
  }

  const bloques = [...vistos.values()].sort((a, b) => a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio));
  // Solapes dentro del archivo: se marcan para que la persona decida cuál conservar.
  bloques.forEach((b, i) => {
    const otro = bloques.find((o, j) => j !== i && o.diaSemana === b.diaSemana && o.inicio < b.fin && b.inicio < o.fin);
    if (otro) b.problemas.push(`Se superpone con «${otro.titulo ?? otro.ubicacion ?? "otro bloque"}» (${otro.inicio}–${otro.fin}).`);
  });
  return { bloques, omitidos };
}
