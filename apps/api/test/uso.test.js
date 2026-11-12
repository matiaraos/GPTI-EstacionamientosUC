import request from "supertest";
import { createApp } from "../dist/app.js";
import { dentroDelPerimetro } from "../dist/lib/geo.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

// Punto publicado del bloque PARKING-7, dentro del campus.
const EN_CAMPUS = { latitud: -33.4975513178705, longitud: -70.61532261345947 };
// Plaza de Armas de Santiago, a varios kilómetros.
const FUERA = { latitud: -33.4378, longitud: -70.6505 };

describe("perímetro", () => {
  const cuadrado = {
    type: "Polygon",
    coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
  };

  test("acepta puntos dentro o a menos del margen del borde y rechaza los lejanos", () => {
    expect(dentroDelPerimetro([0.0005, 0.0005], cuadrado, 0)).toBe(true);
    // ~55 m al este del borde (0,001° de longitud ≈ 111 m en el ecuador).
    expect(dentroDelPerimetro([0.0015, 0.0005], cuadrado, 50)).toBe(false);
    expect(dentroDelPerimetro([0.0015, 0.0005], cuadrado, 60)).toBe(true);
    expect(dentroDelPerimetro([0.01, 0.01], cuadrado, 50)).toBe(false);
  });
});

describe("entrada y salida con QR", () => {
  const db = createTestDatabase();
  // Lunes 16 de noviembre de 2026; la reserva de prueba es de 09:00 a 12:00 (UTC−3).
  const clock = createClock("2026-11-16T10:00:00.000Z");
  const app = createApp({ config: testConfig, db, clock });
  let destinoId;
  let qrs;
  let siguiente = 500;

  const nuevaCuenta = () => registrarEIniciar(app, datosRegistro(String(siguiente++)));
  const horaLocal = (hhmm) => clock.set(`2026-11-16T${String(Number(hhmm.slice(0, 2)) + 3).padStart(2, "0")}:${hhmm.slice(3)}:00.000Z`);

  async function reservar(token, llegada = "09:00", salida = "12:00") {
    const response = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `uso-${siguiente++}-${llegada}`)
      .send({ fecha: "2026-11-16", llegada, salida, destinoId })
      .expect(201);
    return response.body.reserva;
  }

  const entrada = (token, id, body) => request(app).post(`/reservas/${id}/entrada`).set("Authorization", `Bearer ${token}`).send(body);
  const salida = (token, id, body) => request(app).post(`/reservas/${id}/salida`).set("Authorization", `Bearer ${token}`).send(body);
  const qrDe = (codigo) => qrs.find((plaza) => plaza.codigo === codigo).qr;

  beforeAll(async () => {
    await resetDatabase(db);
    await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
    qrs = await sembrarPlazasDemo(db);
    ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  }, 30_000);

  beforeEach(async () => {
    await db.eventoReserva.deleteMany();
    await db.solicitudEspera.deleteMany();
    await db.ajusteRanking.deleteMany();
    await db.reserva.deleteMany();
    clock.set("2026-11-16T10:00:00.000Z");
  });

  afterAll(() => db.$disconnect());

  test("un QR correcto permite entrada y salida; la salida libera la plaza", async () => {
    const token = await nuevaCuenta();
    const reserva = await reservar(token);
    expect(reserva.plaza.codigo).toBe("A1");

    horaLocal("08:50");
    const llegada = await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(201);
    expect(llegada.body.reserva.estado).toBe("en_uso");
    expect(llegada.body.evento).toEqual({ tipo: "entrada", registradoEn: "2026-11-16T11:50:00.000Z" });

    horaLocal("11:40");
    const fin = await salida(token, reserva.id, { qr: qrDe("A1") }).expect(201);
    expect(fin.body.reserva.estado).toBe("finalizada");
    expect(fin.body.evento.tipo).toBe("salida");

    // Con la plaza liberada, otra cuenta puede reservarla en el resto del intervalo.
    const otra = await reservar(await nuevaCuenta(), "11:45", "12:30");
    expect(otra.plaza.codigo).toBe("A1");
  });

  test("repetir una operación confirmada no duplica eventos", async () => {
    const token = await nuevaCuenta();
    const reserva = await reservar(token);
    horaLocal("09:05");
    const primera = await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(201);
    horaLocal("09:06");
    const repetida = await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(200);
    expect(repetida.body.evento.registradoEn).toBe(primera.body.evento.registradoEn);

    const simultaneas = await Promise.all(Array.from({ length: 5 }, () => salida(token, reserva.id, { qr: qrDe("A1") })));
    expect(simultaneas.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(new Set(simultaneas.map((r) => r.body.evento.registradoEn)).size).toBe(1);
    expect(await db.eventoReserva.count({ where: { reservaId: reserva.id } })).toBe(2);
  });

  test("rechaza QR ajenos, revocados o ilegibles sin cambiar la reserva, y una lectura fallida permite reintentar", async () => {
    const token = await nuevaCuenta();
    const reserva = await reservar(token);
    horaLocal("09:00");

    const ajeno = await entrada(token, reserva.id, { qr: qrDe("B1"), ...EN_CAMPUS }).expect(409);
    expect(ajeno.body.error.code).toBe("qr_otra_plaza");
    expect(ajeno.body.error.message).toContain("Tu plaza es A1");

    const ilegible = await entrada(token, reserva.id, { qr: "hola", ...EN_CAMPUS }).expect(400);
    expect(ilegible.body.error.code).toBe("qr_ilegible");

    const identificador = qrDe("A1").slice("MEUC:".length);
    await db.qrPlaza.update({ where: { identificador }, data: { revocadoEn: new Date() } });
    try {
      const revocado = await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(409);
      expect(revocado.body.error.code).toBe("qr_revocado");
    } finally {
      await db.qrPlaza.update({ where: { identificador }, data: { revocadoEn: null } });
    }

    expect((await db.reserva.findUniqueOrThrow({ where: { id: reserva.id } })).estado).toBe("confirmada");
    expect(await db.eventoReserva.count()).toBe(0);
    await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(201);
  });

  test("rechaza el check-in fuera de zona o fuera de la ventana de llegada", async () => {
    const token = await nuevaCuenta();
    const reserva = await reservar(token);

    horaLocal("09:00");
    const lejos = await entrada(token, reserva.id, { qr: qrDe("A1"), ...FUERA }).expect(403);
    expect(lejos.body.error.code).toBe("fuera_de_zona");

    horaLocal("08:40");
    const temprano = await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(409);
    expect(temprano.body.error).toMatchObject({ code: "fuera_de_ventana", message: expect.stringContaining("08:45") });

    horaLocal("09:16");
    const tarde = await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(409);
    expect(tarde.body.error.message).toContain("09:15");

    const sinUbicacion = await entrada(token, reserva.id, { qr: qrDe("A1") }).expect(400);
    expect(sinUbicacion.body.error.details.latitud).toMatch(/ubicación/);
  });

  test("valida la sesión y el estado de la reserva", async () => {
    const token = await nuevaCuenta();
    const reserva = await reservar(token);
    horaLocal("09:00");

    await entrada(await nuevaCuenta(), reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(404);
    await request(app).post(`/reservas/${reserva.id}/entrada`).send({ qr: qrDe("A1"), ...EN_CAMPUS }).expect(401);

    const antes = await salida(token, reserva.id, { qr: qrDe("A1") }).expect(409);
    expect(antes.body.error.message).toBe("Primero registra tu llegada.");

    await request(app).post(`/reservas/${reserva.id}/cancelar`).set("Authorization", `Bearer ${token}`).expect(200);
    const cancelada = await entrada(token, reserva.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(409);
    expect(cancelada.body.error.code).toBe("reserva_no_activa");
  });

  test("si la reserva anterior sigue en uso, impide un segundo check-in en la plaza", async () => {
    const tokenA = await nuevaCuenta();
    const primera = await reservar(tokenA, "09:00", "10:00");
    const tokenB = await nuevaCuenta();
    const segunda = await reservar(tokenB, "10:00", "11:00");
    expect(segunda.plaza.codigo).toBe(primera.plaza.codigo);

    horaLocal("09:00");
    await entrada(tokenA, primera.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(201);
    horaLocal("10:00");
    const conflicto = await entrada(tokenB, segunda.id, { qr: qrDe("A1"), ...EN_CAMPUS }).expect(409);
    expect(conflicto.body.error.code).toBe("plaza_ocupada");
    expect((await db.reserva.findUniqueOrThrow({ where: { id: segunda.id } })).estado).toBe("confirmada");
  });

  test("un perímetro de prueba configurado reemplaza al del campus", async () => {
    const appPrueba = createApp({
      config: {
        ...testConfig,
        reservas: {
          ...testConfig.reservas,
          perimetroPrueba: {
            type: "Polygon",
            coordinates: [[[-70.651, -33.438], [-70.650, -33.438], [-70.650, -33.437], [-70.651, -33.437], [-70.651, -33.438]]],
          },
        },
      },
      db,
      clock,
    });
    const token = await nuevaCuenta();
    const reserva = await reservar(token);
    horaLocal("09:00");
    await request(appPrueba)
      .post(`/reservas/${reserva.id}/entrada`)
      .set("Authorization", `Bearer ${token}`)
      .send({ qr: qrDe("A1"), ...FUERA })
      .expect(201);
  });

  test("el panel lista las plazas con su QR vigente solo para administración", async () => {
    const token = await nuevaCuenta();
    await request(app).get("/admin/plazas").set("Authorization", `Bearer ${token}`).expect(403);
    await db.cuenta.updateMany({ where: { correo: datosRegistro(String(siguiente - 1)).correo }, data: { rol: "admin" } });
    const response = await request(app).get("/admin/plazas").set("Authorization", `Bearer ${token}`).expect(200);
    expect(response.body.plazas.map((plaza) => plaza.codigo)).toEqual(expect.arrayContaining(["A1", "A2", "B1", "B2", "B3"]));
    expect(response.body.plazas.every((plaza) => plaza.qr?.startsWith("MEUC:"))).toBe(true);
  });
});
