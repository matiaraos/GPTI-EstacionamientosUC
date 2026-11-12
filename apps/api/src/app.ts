import cors from "cors";
import express from "express";
import type { RuntimeConfig } from "./config.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import type { Database } from "./lib/prisma.js";
import { crearRutasCatalogo } from "./modules/catalogo/rutas.js";
import { crearRutasCuentas } from "./modules/cuentas/rutas.js";

export type Clock = () => Date;

export type AppDeps = {
  config: RuntimeConfig;
  db: Database;
  /** Reloj del servidor. Las pruebas lo reemplazan para fijar la hora. */
  clock?: Clock;
  /** Comprobación de `/ready`. Por defecto consulta la tabla creada por la migración inicial. */
  checkDatabase?: () => Promise<unknown>;
};

export function createApp(deps: AppDeps) {
  const { config, db } = deps;
  const clock = deps.clock ?? (() => new Date());
  const checkDatabase = deps.checkDatabase ?? (() => db.zona.findFirst({ select: { id: true } }));

  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.adminOrigin }));
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/ready", async (_request, response) => {
    try {
      await checkDatabase();
      response.json({ status: "ok" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  app.use(crearRutasCuentas({ db, clock, auth: config.auth }));
  app.use(crearRutasCatalogo({ db, clock }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
