import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { parseInput } from "../../lib/validation.js";
import { requiereSesion } from "../cuentas/sesiones.js";

type Deps = { db: Database; clock: Clock };

const busquedaSchema = z.object({
  q: z.string().trim().max(80).default(""),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

/** Forma pública de un destino. `id` es el que se envía al preparar una solicitud (03A). */
const destinoPublico = { id: true, idOrigen: true, nombre: true, tipo: true, pisos: true } as const;

export function crearRutasCatalogo({ db, clock }: Deps) {
  const router = Router();
  const conSesion = requiereSesion(db, clock);

  /** Busca salas y edificios por código o nombre, sin distinguir mayúsculas. Coincidencias exactas primero. */
  router.get("/destinos", conSesion, async (request, response) => {
    const { q, limite } = parseInput(busquedaSchema, request.query);
    const escapado = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    const patron = `%${escapado}%`;
    const prefijo = `${escapado}%`;
    const destinos = await db.$queryRaw<
      { id: number; idOrigen: string; nombre: string; tipo: "sala" | "edificio"; pisos: number[] }[]
    >`
      SELECT "id", "idOrigen", "nombre", "tipo", "pisos"
      FROM "Destino"
      WHERE "activo" AND ("nombre" ILIKE ${patron} OR "idOrigen" ILIKE ${patron})
      ORDER BY
        (lower("nombre") = lower(${q}) OR lower("idOrigen") = lower(${q})) DESC,
        ("nombre" ILIKE ${prefijo} OR "idOrigen" ILIKE ${prefijo}) DESC,
        "nombre", "idOrigen"
      LIMIT ${limite}`;
    response.json({ destinos });
  });

  router.get("/destinos/:id", conSesion, async (request, response) => {
    const { id } = parseInput(z.object({ id: z.coerce.number().int().positive() }), request.params);
    const destino = await db.destino.findFirst({ where: { id, activo: true }, select: destinoPublico });
    if (!destino) {
      throw new HttpError(404, "destino_no_encontrado", "El destino no existe en el catálogo.");
    }
    response.json({ destino });
  });

  return router;
}
