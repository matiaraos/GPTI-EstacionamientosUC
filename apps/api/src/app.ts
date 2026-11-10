import cors from "cors";
import express from "express";

export function createApp(adminOrigin: string, checkDatabase: () => Promise<unknown>) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: adminOrigin }));
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

  return app;
}
