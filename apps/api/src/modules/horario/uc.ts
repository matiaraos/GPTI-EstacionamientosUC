import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { restriccionDeExclusion } from "../../lib/prisma-errors.js";
import { parseInput } from "../../lib/validation.js";
import { bloquesDeActividad, MODULOS_UC } from "../catalogo/cursos-uc.js";
import { sesionDe } from "../cuentas/sesiones.js";
import { aHora, aMinutos, DIAS, erroresDeBloques, horarioInvalido } from "./bloques.js";
import { buscarCoincidencias } from "./importacion.js";

type Deps = { db: Database; clock: Clock };

const LETRAS = ["L", "M", "W", "J", "V", "S", "D"];
const TIPOS: Record<string, string> = {
  CLAS: "Cátedra",
  AYU: "Ayudantía",
  LAB: "Laboratorio",
  TAL: "Taller",
  TER: "Terreno",
  PRA: "Práctica",
  LIB: "Libre",
  SUP: "Supervisión",
  TES: "Tesis",
};

const destinoPublico = { id: true, idOrigen: true, nombre: true, tipo: true, pisos: true } as const;
const incluirCurso = {
  actividades: { orderBy: { id: "asc" }, include: { destino: { select: destinoPublico } } },
} as const;

type CursoConActividades = Awaited<ReturnType<typeof cursosPorNrc>>[number];

async function cursosPorNrc(db: Database, nrcs: string[]) {
  return db.cursoUC.findMany({ where: { nrc: { in: nrcs } }, orderBy: [{ sigla: "asc" }, { seccion: "asc" }], include: incluirCurso });
}

/** Forma pública de una sección, como la muestra Buscacursos. */
function seccionPublica(c: CursoConActividades) {
  return {
    nrc: c.nrc,
    sigla: c.sigla,
    seccion: c.seccion,
    nombre: c.nombre,
    creditos: c.creditos,
    semestre: c.semestre,
    actividades: c.actividades.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      tipoNombre: TIPOS[a.tipo] ?? a.tipo,
      modulos: a.modulos,
      horas: bloquesDeActividad(a)
        .filter((b, i, todos) => todos.findIndex((o) => o.inicio === b.inicio) === i)
        .map((b) => `${b.inicio}–${b.fin}`)
        .join(", "),
      sala: a.sala,
      destino: a.destino,
    })),
  };
}

const tituloBloque = (c: { sigla: string; seccion: number; nombre: string }, tipo: string) =>
  `${c.sigla}-${c.seccion} ${c.nombre} · ${TIPOS[tipo] ?? tipo}`;

export type BloquePropuesto = {
  clave: string;
  actividadUCId: number;
  sigla: string;
  seccion: number;
  curso: string;
  tipo: string;
  tipoNombre: string;
  modulosTexto: string;
  modulos: number[];
  diaSemana: number;
  inicio: string;
  fin: string;
  titulo: string;
  sala: string | null;
  destino: { id: number; idOrigen: string; nombre: string; tipo: "sala" | "edificio"; pisos: number[] } | null;
  coincidencias: { id: number; idOrigen: string; nombre: string; tipo: "sala" | "edificio"; pisos: number[] }[];
  problemas: string[];
  /** Propuesta de incluirlo al guardar. La persona puede cambiarla. */
  incluir: boolean;
  cambio: "nuevo" | "sin_cambios" | "modificado";
};

/**
 * Bloques que resultan de la inscripción, comparados con los bloques UC ya guardados. Marca los que
 * requieren elegir destino (sin sala o con varias coincidencias) y los que se superponen.
 */
async function vistaPrevia(db: Database, cuentaId: number, nrcs: string[]) {
  const cursos = await cursosPorNrc(db, nrcs);
  const guardados = await db.bloqueClase.findMany({
    where: { cuentaId },
    include: { destino: { select: destinoPublico } },
    orderBy: [{ diaSemana: "asc" }, { inicioMinuto: "asc" }],
  });
  const ucGuardados = guardados.filter((b) => b.origen === "uc");
  const otros = guardados.filter((b) => b.origen !== "uc");

  const propuestos: BloquePropuesto[] = [];
  for (const curso of cursos) {
    for (const actividad of curso.actividades) {
      for (const tramo of bloquesDeActividad(actividad)) {
        const previo = ucGuardados.find((b) => b.actividadUCId === actividad.id && b.diaSemana === tramo.diaSemana);
        const mismoHorario = previo && aHora(previo.inicioMinuto) === tramo.inicio && aHora(previo.finMinuto) === tramo.fin;
        // Si la persona eligió un destino para una actividad sin sala, se respeta mientras la sala no cambie.
        const destino = actividad.destino ?? (mismoHorario && !actividad.sala ? previo.destino : null);
        const coincidencias = !destino && actividad.sala ? await buscarCoincidencias(db, actividad.sala) : [];
        const problemas: string[] = [];
        if (!destino && !actividad.sala) problemas.push("Sin sala en Buscacursos: elige dónde será o déjalo fuera.");
        else if (!destino && coincidencias.length === 0) problemas.push(`La sala «${actividad.sala}» no está en el catálogo: elige el destino.`);
        else if (!destino) problemas.push(`«${actividad.sala}» coincide con ${coincidencias.length} salas: elige una.`);
        propuestos.push({
          clave: `${actividad.id}:${tramo.diaSemana}:${tramo.inicio}`,
          actividadUCId: actividad.id,
          sigla: curso.sigla,
          seccion: curso.seccion,
          curso: curso.nombre,
          tipo: actividad.tipo,
          tipoNombre: TIPOS[actividad.tipo] ?? actividad.tipo,
          modulosTexto: `${LETRAS[tramo.diaSemana - 1]}:${tramo.modulos.join(",")}`,
          modulos: tramo.modulos,
          diaSemana: tramo.diaSemana,
          inicio: tramo.inicio,
          fin: tramo.fin,
          titulo: tituloBloque(curso, actividad.tipo),
          sala: actividad.sala,
          destino,
          coincidencias,
          problemas,
          incluir: Boolean(destino) || (previo !== undefined && !actividad.sala),
          cambio: !previo ? "nuevo" : mismoHorario && previo.destinoId === destino?.id ? "sin_cambios" : "modificado",
        });
      }
    }
  }
  propuestos.sort((a, b) => a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio));

  // Topes: con otros bloques incluidos del horario UC (el posterior queda fuera) y con bloques propios.
  propuestos.forEach((b, i) => {
    const ini = aMinutos(b.inicio);
    const fin = aMinutos(b.fin);
    const tope = propuestos.find(
      (o, j) => j < i && o.incluir && o.diaSemana === b.diaSemana && aMinutos(o.inicio) < fin && ini < aMinutos(o.fin),
    );
    if (tope) {
      b.problemas.push(`Tope con ${tope.sigla} ${tope.tipoNombre.toLowerCase()} (${tope.inicio}–${tope.fin}).`);
      b.incluir = false;
    }
    const propio = otros.find((o) => o.diaSemana === b.diaSemana && o.inicioMinuto < fin && ini < o.finMinuto);
    if (propio) {
      b.problemas.push(`Se superpone con «${propio.titulo ?? propio.destino.nombre}» (${aHora(propio.inicioMinuto)}–${aHora(propio.finMinuto)}), que agregaste tú.`);
      b.incluir = false;
    }
  });

  const vigentes = new Set(propuestos.map((p) => `${p.actividadUCId}:${p.diaSemana}`));
  const eliminados = ucGuardados
    .filter((b) => !vigentes.has(`${b.actividadUCId}:${b.diaSemana}`))
    .map((b) => ({ id: b.id, titulo: b.titulo, diaSemana: b.diaSemana, inicio: aHora(b.inicioMinuto), fin: aHora(b.finMinuto), destino: b.destino }));
  return { bloques: propuestos, eliminados };
}

async function conexionPublica(db: Database, cuentaId: number) {
  const conexion = await db.conexionUC.findUnique({ where: { cuentaId }, include: { perfil: true } });
  if (!conexion) return null;
  const cursos = await cursosPorNrc(db, conexion.nrcs);
  return {
    perfil: { codigo: conexion.perfil.codigo, nombre: conexion.perfil.nombre, carrera: conexion.perfil.carrera },
    semestre: cursos[0]?.semestre ?? null,
    conectadaEn: conexion.conectadaEn,
    sincronizadaEn: conexion.sincronizadaEn,
    inscripcion: cursos.map(seccionPublica),
    creditos: cursos.reduce((t, c) => t + c.creditos, 0),
  };
}

const sinConexion = () =>
  new HttpError(409, "sin_conexion_uc", "Primero conecta tu horario UC.");

const inscripcionSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("agregar"), nrc: z.string().trim().min(1) }),
  z.object({ accion: z.literal("quitar"), nrc: z.string().trim().min(1) }),
  z.object({ accion: z.literal("cambiar"), nrc: z.string().trim().min(1), por: z.string().trim().min(1) }),
], { error: "Indica si agregas, quitas o cambias una sección." });

const guardarSchema = z.object({
  bloques: z
    .array(
      z.object({
        actividadUCId: z.number().int().positive(),
        diaSemana: z.number().int().min(1).max(7),
        inicio: z.string().regex(/^\d{2}:\d{2}$/),
        fin: z.string().regex(/^\d{2}:\d{2}$/),
        destinoId: z
          .number({ error: "Elige la sala o el edificio de la clase." })
          .int("Elige la sala o el edificio de la clase.")
          .positive("Elige la sala o el edificio de la clase."),
      }),
    )
    .max(80),
});

/**
 * Conexión simulada con el horario UC (03B). En el piloto, la inscripción vendría de los sistemas UC
 * con autorización; aquí proviene de estudiantes de prueba armados con secciones reales de Buscacursos.
 */
export function crearRutasHorarioUC({ db, clock }: Deps) {
  const router = Router();

  /** Busca secciones por sigla o nombre, como Buscacursos (solo San Joaquín, semestre cargado). */
  router.get("/cursos-uc", async (request, response) => {
    const { q } = parseInput(z.object({ q: z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(60) }), request.query);
    const cursos = await db.cursoUC.findMany({
      where: { OR: [{ sigla: { startsWith: q, mode: "insensitive" } }, { nombre: { contains: q, mode: "insensitive" } }] },
      orderBy: [{ sigla: "asc" }, { seccion: "asc" }],
      include: incluirCurso,
      take: 40,
    });
    response.json({ secciones: cursos.map(seccionPublica), modulos: MODULOS_UC });
  });

  router.get("/horario/uc", async (_request, response) => {
    const perfiles = await db.perfilUC.findMany({ orderBy: { codigo: "asc" }, select: { codigo: true, nombre: true, carrera: true, nrcs: true } });
    response.json({
      conexion: await conexionPublica(db, sesionDe(response).cuentaId),
      perfiles: perfiles.map(({ nrcs, ...p }) => ({ ...p, cursos: nrcs.length })),
      modulos: MODULOS_UC,
    });
  });

  /** Conecta la cuenta con un estudiante de prueba. Reemplaza al inicio de sesión UC, que no está autorizado aún. */
  router.post("/horario/uc/conectar", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const { perfil: codigo } = parseInput(z.object({ perfil: z.string({ error: "Elige un estudiante de prueba." }).min(1) }), request.body);
    const perfil = await db.perfilUC.findUnique({ where: { codigo } });
    if (!perfil) {
      throw new HttpError(404, "perfil_no_encontrado", "No encontramos ese estudiante de prueba.");
    }
    const datos = { perfilId: perfil.id, nrcs: perfil.nrcs, conectadaEn: clock(), sincronizadaEn: null };
    await db.conexionUC.upsert({ where: { cuentaId }, create: { cuentaId, ...datos }, update: datos });
    response.json({ conexion: await conexionPublica(db, cuentaId) });
  });

  /** Modificación de horario: agregar, quitar o cambiar de sección dentro de la inscripción simulada. */
  router.patch("/horario/uc/inscripcion", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const datos = parseInput(inscripcionSchema, request.body);
    const conexion = await db.conexionUC.findUnique({ where: { cuentaId } });
    if (!conexion) throw sinConexion();
    const inscritos = await db.cursoUC.findMany({ where: { nrc: { in: conexion.nrcs } }, select: { nrc: true, sigla: true } });
    let nrcs = conexion.nrcs;
    if (datos.accion === "quitar") {
      if (!nrcs.includes(datos.nrc)) throw new HttpError(404, "seccion_no_inscrita", "Esa sección no está en tu inscripción.");
      nrcs = nrcs.filter((n) => n !== datos.nrc);
    } else {
      const nueva = await db.cursoUC.findUnique({ where: { nrc: datos.accion === "agregar" ? datos.nrc : datos.por } });
      if (!nueva) throw new HttpError(404, "seccion_no_encontrada", "No encontramos esa sección en el semestre cargado.");
      if (datos.accion === "agregar") {
        const misma = inscritos.find((c) => c.sigla === nueva.sigla);
        if (misma) {
          throw new HttpError(409, "curso_inscrito", `Ya inscribes ${nueva.sigla}. Usa «Cambiar sección» para moverte a la sección ${nueva.seccion}.`);
        }
        nrcs = [...nrcs, nueva.nrc];
      } else {
        const actual = inscritos.find((c) => c.nrc === datos.nrc);
        if (!actual) throw new HttpError(404, "seccion_no_inscrita", "Esa sección no está en tu inscripción.");
        if (actual.sigla !== nueva.sigla) {
          throw new HttpError(400, "datos_invalidos", "Solo puedes cambiarte a otra sección del mismo curso.", { por: "Elige una sección de la misma sigla." });
        }
        nrcs = nrcs.map((n) => (n === datos.nrc ? nueva.nrc : n));
      }
    }
    await db.conexionUC.update({ where: { cuentaId }, data: { nrcs } });
    response.json({ conexion: await conexionPublica(db, cuentaId) });
  });

  /** Bloques que produciría la inscripción vigente, con sus diferencias respecto de lo guardado. No guarda. */
  router.post("/horario/uc/vista-previa", async (_request, response) => {
    const { cuentaId } = sesionDe(response);
    const conexion = await db.conexionUC.findUnique({ where: { cuentaId } });
    if (!conexion) throw sinConexion();
    response.json(await vistaPrevia(db, cuentaId, conexion.nrcs));
  });

  /**
   * Sincroniza: reemplaza los bloques de origen UC por los confirmados, sin tocar los bloques
   * agregados a mano o importados. Si algún bloque es inválido, no cambia nada.
   */
  router.put("/horario/uc", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const { bloques } = parseInput(guardarSchema, request.body);
    const conexion = await db.conexionUC.findUnique({ where: { cuentaId } });
    if (!conexion) throw sinConexion();
    const actividades = await db.actividadUC.findMany({
      where: { id: { in: bloques.map((b) => b.actividadUCId) }, curso: { nrc: { in: conexion.nrcs } } },
      include: { curso: true },
    });
    const porId = new Map(actividades.map((a) => [a.id, a]));
    const details: Record<string, string> = {};
    bloques.forEach((b, i) => {
      const actividad = porId.get(b.actividadUCId);
      const valido = actividad && bloquesDeActividad(actividad).some((t) => t.diaSemana === b.diaSemana && t.inicio === b.inicio && t.fin === b.fin);
      if (!valido) details[`bloques.${i}.actividadUCId`] = "El bloque no corresponde a tu inscripción. Vuelve a revisar el horario.";
    });
    const otros = await db.bloqueClase.findMany({ where: { cuentaId, origen: { not: "uc" } } });
    Object.assign(
      details,
      await erroresDeBloques(
        db,
        bloques.map((b) => ({ ...b, titulo: null, origen: "manual" as const })),
        (i) => `bloques.${i}.`,
        otros,
      ),
    );
    if (Object.keys(details).length > 0) throw horarioInvalido(details);
    try {
      await db.$transaction([
        db.bloqueClase.deleteMany({ where: { cuentaId, origen: "uc" } }),
        db.bloqueClase.createMany({
          data: bloques.map((b) => {
            const actividad = porId.get(b.actividadUCId)!;
            return {
              cuentaId,
              destinoId: b.destinoId,
              diaSemana: b.diaSemana,
              inicioMinuto: aMinutos(b.inicio),
              finMinuto: aMinutos(b.fin),
              titulo: tituloBloque(actividad.curso, actividad.tipo),
              origen: "uc" as const,
              actividadUCId: actividad.id,
            };
          }),
        }),
        db.conexionUC.update({ where: { cuentaId }, data: { sincronizadaEn: clock() } }),
      ]);
    } catch (error) {
      if (restriccionDeExclusion(error) !== null) throw horarioInvalido({ bloques: `Hay bloques que se superponen el mismo día (${DIAS.join(", ")}).` });
      throw error;
    }
    response.json({ conexion: await conexionPublica(db, cuentaId) });
  });

  /** Desconecta. Con `bloques=conservar` los bloques UC pasan a ser propios; si no, se quitan. */
  router.delete("/horario/uc", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const { bloques } = parseInput(z.object({ bloques: z.enum(["quitar", "conservar"]).default("quitar") }), request.query);
    await db.$transaction([
      bloques === "quitar"
        ? db.bloqueClase.deleteMany({ where: { cuentaId, origen: "uc" } })
        : db.bloqueClase.updateMany({ where: { cuentaId, origen: "uc" }, data: { origen: "manual", actividadUCId: null } }),
      db.conexionUC.deleteMany({ where: { cuentaId } }),
    ]);
    response.status(204).end();
  });

  return router;
}
