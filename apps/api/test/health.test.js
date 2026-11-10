import request from "supertest";
import { createApp } from "../dist/app.js";

const adminOrigin = "http://localhost:5173";

test("informa que la API está activa aunque no haya conexión a PostgreSQL", async () => {
  const checkDatabase = async () => {
    throw new Error("Base no disponible");
  };
  const app = createApp(adminOrigin, checkDatabase);

  await request(app).get("/health").expect(200, { status: "ok" });
  await request(app).get("/ready").expect(503, { status: "unavailable" });
});

test("confirma que PostgreSQL está disponible y admite el origen del panel", async () => {
  const app = createApp(adminOrigin, async () => null);

  await request(app)
    .get("/ready")
    .set("Origin", adminOrigin)
    .expect("Access-Control-Allow-Origin", adminOrigin)
    .expect(200, { status: "ok" });
});
