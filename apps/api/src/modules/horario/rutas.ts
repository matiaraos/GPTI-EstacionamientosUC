import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { restriccionDeExclusion } from "../../lib/prisma-errors.js";
import { parseInput } from "../../lib/validation.js";
import { requiereSesion, sesionDe } from "../cuentas/sesiones.js";
import { aHora, bloquePublico, bloqueSchema, datosFila, erroresDeBloques, horarioInvalido, incluirBloque } from "./bloques.js";
import { previsualizarIcs } from "./importacion.js";

type Deps = { db: Database; clock: Clock };

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const reemplazoSchema = z.object({ bloques: z.array(bloqueSchema).max(60, "El horario admite hasta 60 bloques.") });
const importacionSchema = z.object({
  contenido: z.string({ error: "Adjunta el archivo .ics." }).min(1, "El archivo está vacío.").max(1_000_000, "El archivo es demasiado grande."),
});

const solapado = () => horarioInvalido({ inicio: "Se superpone con otro bloque de ese día." });

/** Horario semanal de la persona (03B). Editarlo no cambia reservas ya confirmadas. */
export function crearRutasHorario({ db, clock }: Deps) {
  const router = Router();
  router.use("/horario", requiereSesion(db, clock));

  const listar = async (cuentaId: number) =>
    (
      await db.bloqueClase.findMany({
        where: { cuentaId },
        orderBy: [{ diaSemana: "asc" }, { inicioMinuto: "asc" }],
        include: incluirBloque,
      })
    ).map(bloquePublico);

  router.get("/horario", async (_request, response) => {
    response.json({ bloques: await listar(sesionDe(response).cuentaId) });
  });

  /** Reemplaza el horario completo en una transacción. Si algún bloque es inválido, no cambia nada. */
  router.put("/horario", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const { bloques } = parseInput(reemplazoSchema, request.body);
    const details = await erroresDeBloques(db, bloques, (i) => `bloques.${i}.`);
    if (Object.keys(details).length > 0) {
      throw horarioInvalido(details);
    }
    await db.$transaction([
      db.bloqueClase.deleteMany({ where: { cuentaId } }),
      db.bloqueClase.createMany({ data: bloques.map((b) => datosFila(cuentaId, b)) }),
    ]);
    response.json({ bloques: await listar(cuentaId) });
  });

  router.post("/horario/bloques", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const datos = parseInput(bloqueSchema, request.body);
    const otros = await db.bloqueClase.findMany({ where: { cuentaId, diaSemana: datos.diaSemana } });
    const details = await erroresDeBloques(db, [datos], () => "", otros);
    if (Object.keys(details).length > 0) {
      throw horarioInvalido(details);
    }
    try {
      const bloque = await db.bloqueClase.create({ data: datosFila(cuentaId, datos), include: incluirBloque });
      response.status(201).json({ bloque: bloquePublico(bloque) });
    } catch (error) {
      if (restriccionDeExclusion(error) !== null) throw solapado();
      throw error;
    }
  });

  router.patch("/horario/bloques/:id", async (request, response) => {
    const { cuentaId } = sesionDe(response);
    const { id } = parseInput(idSchema, request.params);
    const actual = await db.bloqueClase.findFirst({ where: { id, cuentaId } });
    if (!actual) {
      throw new HttpError(404, "bloque_no_encontrado", "No encontramos ese bloque de tu horario.");
    }
    const datos = parseInput(bloqueSchema, {
      diaSemana: actual.diaSemana,
      inicio: aHora(actual.inicioMinuto),
      fin: aHora(actual.finMinuto),
      destinoId: actual.destinoId,
      titulo: actual.titulo,
      ...request.body,
    });
    const otros = await db.bloqueClase.findMany({ where: { cuentaId, diaSemana: datos.diaSemana, id: { not: id } } });
    const details = await erroresDeBloques(db, [datos], () => "", otros);
    if (Object.keys(details).length > 0) {
      throw horarioInvalido(details);
    }
    try {
      const bloque = await db.bloqueClase.update({
        where: { id },
        data: datosFila(cuentaId, datos),
        include: incluirBloque,
      });
      response.json({ bloque: bloquePublico(bloque) });
    } catch (error) {
      if (restriccionDeExclusion(error) !== null) throw solapado();
      throw error;
    }
  });

  router.delete("/horario/bloques/:id", async (request, response) => {
    const { id } = parseInput(idSchema, request.params);
    await db.bloqueClase.deleteMany({ where: { id, cuentaId: sesionDe(response).cuentaId } });
    response.status(204).end();
  });

  /** Vista previa de un `.ics`: propone bloques y marca los que requieren corrección. No guarda nada. */
  router.post("/horario/importar", async (request, response) => {
    const { contenido } = parseInput(importacionSchema, request.body);
    response.json(await previsualizarIcs(db, contenido));
  });

  return router;
}
