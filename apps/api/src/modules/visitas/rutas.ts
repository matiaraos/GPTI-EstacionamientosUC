import { Router } from "express";
import type { Clock } from "../../app.js";
import type { Database } from "../../lib/prisma.js";
import { parseInput } from "../../lib/validation.js";
import { requiereSesion } from "../cuentas/sesiones.js";
import { validarVisita, visitaSchema } from "./validacion.js";

type Deps = { db: Database; clock: Clock };

export function crearRutasVisitas({ db, clock }: Deps) {
  const router = Router();

  /** Prepara una solicitud: valida destino y permanencia y devuelve el intervalo en UTC. */
  router.post("/visitas/validar", requiereSesion(db, clock), async (request, response) => {
    const visita = await validarVisita(db, parseInput(visitaSchema, request.body));
    response.json({ visita });
  });

  return router;
}
