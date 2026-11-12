import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Database } from "../../lib/prisma.js";

/** Módulos del horario UC (Buscacursos): nueve módulos de 70 minutos con almuerzo entre el 4 y el 5. */
export const MODULOS_UC = [
  { modulo: 1, inicio: "08:20", fin: "09:30" },
  { modulo: 2, inicio: "09:40", fin: "10:50" },
  { modulo: 3, inicio: "11:00", fin: "12:10" },
  { modulo: 4, inicio: "12:20", fin: "13:30" },
  { modulo: 5, inicio: "14:50", fin: "16:00" },
  { modulo: 6, inicio: "16:10", fin: "17:20" },
  { modulo: 7, inicio: "17:30", fin: "18:40" },
  { modulo: 8, inicio: "18:50", fin: "20:00" },
  { modulo: 9, inicio: "20:10", fin: "21:20" },
] as const;

const DIAS: Record<string, number> = { L: 1, M: 2, W: 3, J: 4, V: 5, S: 6, D: 7 };

export type ActividadFuente = { modulos: string; tipo: string; sala: string | null };
export type SeccionFuente = { nrc: string; sigla: string; seccion: number; nombre: string; creditos: number; horario: ActividadFuente[] };
export type FuenteCursosUC = {
  semestre: string;
  perfiles: { codigo: string; nombre: string; carrera: string; nrcs: string[] }[];
  secciones: SeccionFuente[];
};

/** `L-W-V:4` → días [1, 3, 5] y módulos [4]; `M:5,6` → días [2] y módulos [5, 6]. */
export function leerModulos(texto: string): { dias: number[]; numeros: number[] } {
  const coincidencia = /^([LMWJVSD](?:-[LMWJVSD])*):(\d(?:,\d)*)$/.exec(texto.trim());
  if (!coincidencia) {
    throw new Error(`Horario de Buscacursos con formato desconocido: «${texto}».`);
  }
  const dias = coincidencia[1].split("-").map((d) => DIAS[d]);
  const numeros = coincidencia[2].split(",").map(Number);
  if (numeros.some((n) => n < 1 || n > MODULOS_UC.length)) {
    throw new Error(`Módulo fuera de rango en «${texto}».`);
  }
  return { dias, numeros };
}

/**
 * Bloques continuos de una actividad: un bloque por día, uniendo módulos consecutivos (por ejemplo,
 * `M:5,6` es un bloque de 14:50 a 17:20).
 */
export function bloquesDeActividad(actividad: { dias: number[]; numeros: number[] }) {
  const ordenados = [...actividad.numeros].sort((a, b) => a - b);
  const tramos: number[][] = [];
  for (const n of ordenados) {
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.at(-1) === n - 1) ultimo.push(n);
    else tramos.push([n]);
  }
  return actividad.dias.flatMap((diaSemana) =>
    tramos.map((modulos) => ({
      diaSemana,
      modulos,
      inicio: MODULOS_UC[modulos[0] - 1].inicio as string,
      fin: MODULOS_UC[modulos.at(-1)! - 1].fin as string,
    })),
  );
}

export const archivoCursosUC = (directorioCatalogo: string) => path.join(directorioCatalogo, "cursos-uc.json");

export async function leerCursosUC(directorioCatalogo: string): Promise<FuenteCursosUC> {
  return JSON.parse(await readFile(archivoCursosUC(directorioCatalogo), "utf8")) as FuenteCursosUC;
}

/** Sala del catálogo para el código de Buscacursos: `AE002` → `AE002-SJ`. Solo si la coincidencia es única. */
async function destinoDeSala(db: Database, sala: string | null): Promise<number | null> {
  if (!sala) return null;
  const candidatos = await db.$queryRaw<{ id: number }[]>`
    SELECT "id" FROM "Destino"
    WHERE "activo" AND "tipo" = 'sala'
      AND (upper("idOrigen") = upper(${sala}) OR upper("idOrigen") = upper(${sala}) || '-SJ' OR upper("nombre") = upper(${sala}))
    LIMIT 2`;
  return candidatos.length === 1 ? candidatos[0].id : null;
}

/**
 * Carga secciones, actividades y perfiles de prueba. Es idempotente: identifica las secciones por NRC
 * y conserva los IDs de las actividades que no cambian, para que los bloques ya sincronizados sigan
 * enlazados.
 */
export async function importarCursosUC(db: Database, fuente: FuenteCursosUC) {
  let actividades = 0;
  for (const s of fuente.secciones) {
    const curso = await db.cursoUC.upsert({
      where: { nrc: s.nrc },
      create: { semestre: fuente.semestre, nrc: s.nrc, sigla: s.sigla, seccion: s.seccion, nombre: s.nombre, creditos: s.creditos },
      update: { semestre: fuente.semestre, sigla: s.sigla, seccion: s.seccion, nombre: s.nombre, creditos: s.creditos },
    });
    const existentes = await db.actividadUC.findMany({ where: { cursoId: curso.id }, orderBy: { id: "asc" } });
    for (const [i, a] of s.horario.entries()) {
      const datos = { tipo: a.tipo, modulos: a.modulos, ...leerModulos(a.modulos), sala: a.sala, destinoId: await destinoDeSala(db, a.sala) };
      if (existentes[i]) await db.actividadUC.update({ where: { id: existentes[i].id }, data: datos });
      else await db.actividadUC.create({ data: { cursoId: curso.id, ...datos } });
      actividades++;
    }
    if (existentes.length > s.horario.length) {
      await db.actividadUC.deleteMany({ where: { id: { in: existentes.slice(s.horario.length).map((a) => a.id) } } });
    }
  }
  for (const p of fuente.perfiles) {
    await db.perfilUC.upsert({ where: { codigo: p.codigo }, create: p, update: p });
  }
  return { secciones: fuente.secciones.length, actividades, perfiles: fuente.perfiles.length };
}
