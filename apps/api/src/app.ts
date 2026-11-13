import cors from "cors";
import express from "express";
import type { RuntimeConfig } from "./config.js";
import { crearMailer, type Mailer } from "./lib/correo.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import type { Database } from "./lib/prisma.js";
import { crearRutasAvisos } from "./modules/avisos/rutas.js";
import { crearRutasCatalogo } from "./modules/catalogo/rutas.js";
import { crearRutasCuentas } from "./modules/cuentas/rutas.js";
import { crearRutasHorario } from "./modules/horario/rutas.js";
import { crearRutasInventario } from "./modules/inventario/rutas.js";
import { crearRutasOperacion } from "./modules/operacion/rutas.js";
import { crearRutasRanking } from "./modules/ranking/rutas.js";
import { crearRutasReservas } from "./modules/reservas/rutas.js";
import { crearRutasVisitas } from "./modules/visitas/rutas.js";

export type Clock = () => Date;

export type AppDeps = {
  config: RuntimeConfig;
  db: Database;
  /** Reloj del servidor. Las pruebas lo reemplazan para fijar la hora. */
  clock?: Clock;
  /** Canal de correo (recuperación de contraseña). Por defecto escribe los correos en la consola. */
  mailer?: Mailer;
  /** Comprobación de `/ready`. Por defecto consulta la tabla creada por la migración inicial. */
  checkDatabase?: () => Promise<unknown>;
};

export function createApp(deps: AppDeps) {
  const { config, db } = deps;
  const clock = deps.clock ?? (() => new Date());
  const mailer = deps.mailer ?? crearMailer(null, "");
  const checkDatabase = deps.checkDatabase ?? (() => db.zona.findFirst({ select: { id: true } }));

  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.adminOrigin }));
  // Hasta 2 MB para admitir calendarios .ics completos (03B).
  app.use(express.json({ limit: "2mb" }));

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

  app.use(crearRutasCuentas({ db, clock, auth: config.auth, mailer, ranking: config.ranking }));
  app.use(crearRutasAvisos({ db, clock }));
  app.use(crearRutasCatalogo({ db, clock }));
  app.use(crearRutasVisitas({ db, clock }));
  app.use(crearRutasInventario({ db, clock, reservas: config.reservas, ranking: config.ranking }));
  app.use(crearRutasHorario({ db, clock }));
  app.use(crearRutasOperacion({ db, clock, reservas: config.reservas, ranking: config.ranking }));
  app.use(crearRutasRanking({ db, clock, reservas: config.reservas, ranking: config.ranking }));
  app.use(crearRutasReservas({ db, clock, config: config.reservas, ranking: config.ranking }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
