import request from "supertest";
import { createApp } from "../dist/app.js";
import { instanteLocal, partesLocales } from "../dist/lib/tiempo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { createClock, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

describe("hora de Santiago", () => {
  test("convierte una hora local de verano (UTC−3) e invierno (UTC−4)", () => {
    expect(instanteLocal("2026-11-16", "09:00")?.toISOString()).toBe("2026-11-16T12:00:00.000Z");
    expect(instanteLocal("2026-06-15", "09:00")?.toISOString()).toBe("2026-06-15T13:00:00.000Z");
  });

  test("una hora que no existe por el cambio de horario devuelve null", () => {
    expect(instanteLocal("2026-09-06", "00:30")).toBeNull();
    expect(instanteLocal("2026-09-06", "01:30")?.toISOString()).toBe("2026-09-06T04:30:00.000Z");
  });

  test("una hora repetida al terminar el horario de verano toma la primera ocurrencia", () => {
    expect(instanteLocal("2026-04-04", "23:30")?.toISOString()).toBe("2026-04-05T02:30:00.000Z");
  });

  test("entrega fecha, hora y día de la semana locales", () => {
    expect(partesLocales(new Date("2026-11-17T02:30:00Z"))).toEqual({
      fecha: "2026-11-16",
      hora: "23:30",
      minutoDelDia: 23 * 60 + 30,
      diaSemana: 1,
    });
  });
});

describe("POST /visitas/validar", () => {
  const db = createTestDatabase();
  const app = createApp({ config: testConfig, db, clock: createClock() });
  let token;
  let destinoId;

  beforeAll(async () => {
    await resetDatabase(db);
    await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
    token = await registrarEIniciar(app);
    ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  }, 30_000);

  afterAll(() => db.$disconnect());

  const validar = (body) => request(app).post("/visitas/validar").set("Authorization", `Bearer ${token}`).send(body);

  test("un destino válido y una salida posterior a la llegada preparan la solicitud", async () => {
    const response = await validar({ fecha: "2026-11-16", llegada: "08:15", salida: "13:30", destinoId }).expect(200);
    expect(response.body.visita).toEqual({
      fecha: "2026-11-16",
      llegada: "08:15",
      salida: "13:30",
      inicio: "2026-11-16T11:15:00.000Z",
      fin: "2026-11-16T16:30:00.000Z",
      destino: { id: destinoId, idOrigen: "ED113-SJ", nombre: "ED113", tipo: "sala" },
    });
  });

  test("también acepta un edificio como destino", async () => {
    const edificio = await db.destino.findFirstOrThrow({ where: { tipo: "edificio" } });
    const response = await validar({ fecha: "2026-11-16", llegada: "10:00", salida: "11:00", destinoId: edificio.id }).expect(200);
    expect(response.body.visita.destino.tipo).toBe("edificio");
  });

  test("sin destino, informa el campo", async () => {
    const response = await validar({ fecha: "2026-11-16", llegada: "08:00", salida: "10:00" }).expect(400);
    expect(response.body.error.details).toEqual({ destinoId: expect.stringContaining("destino") });
  });

  test("un ID de destino inexistente se rechaza", async () => {
    const response = await validar({ fecha: "2026-11-16", llegada: "08:00", salida: "10:00", destinoId: 999999 }).expect(400);
    expect(response.body.error.details.destinoId).toMatch(/no existe/);
  });

  test("una salida igual o anterior a la llegada se rechaza", async () => {
    for (const salida of ["08:00", "07:59"]) {
      const response = await validar({ fecha: "2026-11-16", llegada: "08:00", salida, destinoId }).expect(400);
      expect(response.body.error.details).toEqual({ salida: "La salida debe ser posterior a la llegada." });
    }
  });

  test("fechas y horas mal formadas o inexistentes se informan por campo", async () => {
    const response = await validar({ fecha: "2026-02-30", llegada: "25:00", salida: "9:00", destinoId }).expect(400);
    expect(Object.keys(response.body.error.details).sort()).toEqual(["fecha", "llegada", "salida"]);

    const salto = await validar({ fecha: "2026-09-06", llegada: "00:30", salida: "02:00", destinoId }).expect(400);
    expect(salto.body.error.details.llegada).toMatch(/cambio de horario/);
  });

  test("varios errores se devuelven juntos", async () => {
    const response = await validar({ fecha: "2026-11-16", llegada: "10:00", salida: "09:00", destinoId: 999999 }).expect(400);
    expect(Object.keys(response.body.error.details).sort()).toEqual(["destinoId", "salida"]);
  });

  test("exige sesión", async () => {
    await request(app).post("/visitas/validar").send({}).expect(401);
  });
});
