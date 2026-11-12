import request from "supertest";
import { createApp } from "../dist/app.js";
import { testConfig as config } from "./helpers/app.js";
import { createTestDatabase } from "./helpers/db.js";

test("informa que la API está activa aunque no haya conexión a PostgreSQL", async () => {
  const checkDatabase = async () => {
    throw new Error("Base no disponible");
  };
  const app = createApp({ config, db: {}, checkDatabase });

  await request(app).get("/health").expect(200, { status: "ok" });
  await request(app).get("/ready").expect(503, { status: "unavailable" });
});

test("confirma que PostgreSQL está disponible y admite el origen del panel", async () => {
  const db = createTestDatabase();
  try {
    const app = createApp({ config, db });

    await request(app)
      .get("/ready")
      .set("Origin", config.adminOrigin)
      .expect("Access-Control-Allow-Origin", config.adminOrigin)
      .expect(200, { status: "ok" });
  } finally {
    await db.$disconnect();
  }
});

test("responde en español a rutas inexistentes y JSON inválido", async () => {
  const app = createApp({ config, db: {}, checkDatabase: async () => null });

  const missing = await request(app).get("/no-existe").expect(404);
  expect(missing.body.error.code).toBe("ruta_no_encontrada");

  const invalid = await request(app)
    .post("/no-existe")
    .set("Content-Type", "application/json")
    .send("{malformado")
    .expect(400);
  expect(invalid.body.error.code).toBe("json_invalido");
});
