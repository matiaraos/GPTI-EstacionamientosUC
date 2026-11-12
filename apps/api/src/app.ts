import cors from "cors";
import express from "express";
import type { AppConfig } from "./config.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import type { Database } from "./lib/prisma.js";

export type Clock = () => Date;

export type AppDeps = {
  config: Pick<AppConfig, "adminOrigin">;
  db: Database;
  /** Reloj del servidor. Las pruebas lo reemplazan para fijar la hora. */
  clock?: Clock;
  /** Comprobación de `/ready`. Por defecto consulta la tabla creada por la migración inicial. */
  checkDatabase?: () => Promise<unknown>;
};

export function createApp(deps: AppDeps) {
  const checkDatabase =
    deps.checkDatabase ?? (() => deps.db.parkingZone.findFirst({ select: { id: true } }));

  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: deps.config.adminOrigin }));
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

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
