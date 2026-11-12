import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
// Lunes 16 de noviembre de 2026, 07:00 en Santiago.
const clock = createClock("2026-11-16T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
let fuentes;
let destinoId;
let siguienteCuenta = 1;
let siguienteClave = 1;

const visita = (cambios = {}) => ({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId, ...cambios });

async function nuevaCuenta() {
  return registrarEIniciar(app, datosRegistro(String(siguienteCuenta++)));
}

function solicitar(token, body = visita(), clave = `clave-solicitud-${siguienteClave++}`) {
  return request(app)
    .post("/reservas")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", clave)
    .send(body);
}

/** Cambia la cercanía de los bloques de demo al destino de prueba. `null` elimina la fila. */
async function fijarCercania(bloque, valores) {
  const zona = await db.zona.findUniqueOrThrow({ where: { idOrigen: bloque } });
  const where = { zonaId_destinoId: { zonaId: zona.id, destinoId } };
  if (valores === null) {
    await db.cercaniaBloque.delete({ where });
  } else {
    await db.cercaniaBloque.update({ where, data: valores });
  }
}

beforeAll(async () => {
  await resetDatabase(db);
  fuentes = await leerFuentesCatalogo(directorioCatalogo);
  await importarCatalogo(db, fuentes);
  await sembrarPlazasDemo(db);
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
}, 30_000);

beforeEach(async () => {
  await db.solicitudEspera.deleteMany();
  await db.ajusteRanking.deleteMany();
  await db.reserva.deleteMany();
  clock.set("2026-11-16T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

describe("asignación por cercanía", () => {
  test("asigna el bloque más cercano por la red peatonal y muestra bloque, plaza, horario y distancia", async () => {
    const response = await solicitar(await nuevaCuenta()).expect(201);
    expect(response.body.reserva).toMatchObject({
      estado: "confirmada",
      fecha: "2026-11-16",
      llegada: "09:00",
      salida: "12:00",
      inicio: "2026-11-16T12:00:00.000Z",
      fin: "2026-11-16T15:00:00.000Z",
      zona: { nombre: "Est. Subterráneo Centro de innovación" },
      plaza: { codigo: "A1" },
      metros: 240,
      metodoDistancia: "peatonal",
      destino: { idOrigen: "ED113-SJ" },
    });
  });

  test("si el primer bloque está lleno, confirma en el segundo", async () => {
    const asignadas = [];
    for (let i = 0; i < 3; i++) {
      const response = await solicitar(await nuevaCuenta()).expect(201);
      asignadas.push(`${response.body.reserva.zona.nombre}/${response.body.reserva.plaza.codigo}`);
    }
    expect(asignadas).toEqual([
      "Est. Subterráneo Centro de innovación/A1",
      "Est. Subterráneo Centro de innovación/A2",
      "Estacionamiento 4/B1",
    ]);
  });

  describe("con distancias modificadas", () => {
    afterEach(() => importarCatalogo(db, fuentes), 30_000);

    test("un bloque con ruta peatonal tiene prioridad sobre uno más cercano en línea recta", async () => {
      await fijarCercania("PARKING-7", { metodo: "linea_recta", metros: 50 });
      await fijarCercania("PARKING-5", { metodo: "peatonal", metros: 400 });
      const response = await solicitar(await nuevaCuenta()).expect(201);
      expect(response.body.reserva).toMatchObject({ plaza: { codigo: "B1" }, metodoDistancia: "peatonal", metros: 400 });
    });

    test("si solo hay distancias en línea recta, elige la más cercana y etiqueta el método", async () => {
      await fijarCercania("PARKING-7", { metodo: "linea_recta", metros: 120 });
      await fijarCercania("PARKING-5", { metodo: "linea_recta", metros: 80 });
      const response = await solicitar(await nuevaCuenta()).expect(201);
      expect(response.body.reserva).toMatchObject({ plaza: { codigo: "B1" }, metodoDistancia: "linea_recta", metros: 80 });
    });

    test("un bloque sin distancia al destino se omite del orden", async () => {
      await fijarCercania("PARKING-7", null);
      const response = await solicitar(await nuevaCuenta()).expect(201);
      expect(response.body.reserva.plaza.codigo).toBe("B1");
    });

    test("si hay cupo pero faltan todas las distancias, informa el problema de catálogo sin reservar", async () => {
      await fijarCercania("PARKING-7", null);
      await fijarCercania("PARKING-5", null);
      const response = await solicitar(await nuevaCuenta()).expect(422);
      expect(response.body.error.code).toBe("sin_cercania");
      expect(await db.reserva.count()).toBe(0);
    });
  });
});

describe("disponibilidad", () => {
  test("sin cupo, lo informa sin crear una reserva", async () => {
    for (let i = 0; i < 5; i++) {
      await solicitar(await nuevaCuenta()).expect(201);
    }
    const response = await solicitar(await nuevaCuenta()).expect(409);
    expect(response.body.error.code).toBe("sin_cupo");
    expect(await db.reserva.count()).toBe(5);
  });

  test("fuera del horario de los bloques no hay cupo", async () => {
    // Domingo: los bloques de demo no abren.
    const response = await solicitar(await nuevaCuenta(), visita({ fecha: "2026-11-22" })).expect(409);
    expect(response.body.error.code).toBe("sin_cupo");
    // Sábado de 08:00 a 14:00: una visita hasta las 15:00 no cabe.
    await solicitar(await nuevaCuenta(), visita({ fecha: "2026-11-21", llegada: "09:00", salida: "15:00" })).expect(409);
    await solicitar(await nuevaCuenta(), visita({ fecha: "2026-11-21", llegada: "09:00", salida: "14:00" })).expect(201);
  });

  test("una plaza inactiva no se asigna", async () => {
    await db.plaza.updateMany({ where: { codigo: "A1" }, data: { activa: false } });
    try {
      const response = await solicitar(await nuevaCuenta()).expect(201);
      expect(response.body.reserva.plaza.codigo).toBe("A2");
    } finally {
      await db.plaza.updateMany({ where: { codigo: "A1" }, data: { activa: true } });
    }
  });

  test("una llegada que ya pasó se rechaza", async () => {
    clock.set("2026-11-16T12:30:00.000Z"); // 09:30 en Santiago, más allá de la tolerancia de 15 minutos
    const response = await solicitar(await nuevaCuenta()).expect(400);
    expect(response.body.error.details.llegada).toMatch(/ya pasó/);
  });
});

describe("cancelación", () => {
  test("cancelar antes del check-in libera el intervalo y repetirla no cambia nada", async () => {
    const tokenA = await nuevaCuenta();
    const { reserva } = (await solicitar(tokenA).expect(201)).body;

    const cancelada = await request(app)
      .post(`/reservas/${reserva.id}/cancelar`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(cancelada.body.reserva.estado).toBe("cancelada");
    await request(app).post(`/reservas/${reserva.id}/cancelar`).set("Authorization", `Bearer ${tokenA}`).expect(200);

    const otra = await solicitar(await nuevaCuenta()).expect(201);
    expect(otra.body.reserva.plaza.codigo).toBe(reserva.plaza.codigo);

    const vigentes = await request(app).get("/reservas/vigentes").set("Authorization", `Bearer ${tokenA}`).expect(200);
    expect(vigentes.body.reservas).toEqual([]);
  });

  test("no se puede cancelar la reserva de otra cuenta ni una en uso", async () => {
    const tokenA = await nuevaCuenta();
    const { reserva } = (await solicitar(tokenA).expect(201)).body;
    await request(app)
      .post(`/reservas/${reserva.id}/cancelar`)
      .set("Authorization", `Bearer ${await nuevaCuenta()}`)
      .expect(404);

    await db.reserva.update({ where: { id: reserva.id }, data: { estado: "en_uso" } });
    const response = await request(app)
      .post(`/reservas/${reserva.id}/cancelar`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(409);
    expect(response.body.error.code).toBe("reserva_no_cancelable");
  });
});

describe("reintentos e idempotencia", () => {
  test("el reintento de una solicitud confirmada devuelve la misma reserva", async () => {
    const token = await nuevaCuenta();
    const primera = await solicitar(token, visita(), "misma-clave-1").expect(201);
    const segunda = await solicitar(token, visita(), "misma-clave-1").expect(200);
    expect(segunda.body.reserva.id).toBe(primera.body.reserva.id);
    expect(await db.reserva.count()).toBe(1);
  });

  test("reintentos simultáneos con la misma clave crean una sola reserva", async () => {
    const token = await nuevaCuenta();
    const respuestas = await Promise.all(Array.from({ length: 6 }, () => solicitar(token, visita(), "misma-clave-2")));
    expect(new Set(respuestas.map((r) => r.body.reserva?.id)).size).toBe(1);
    expect(respuestas.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(await db.reserva.count()).toBe(1);
  });

  test("la misma clave con otros datos se rechaza", async () => {
    const token = await nuevaCuenta();
    await solicitar(token, visita(), "misma-clave-3").expect(201);
    const response = await solicitar(token, visita({ salida: "13:00" }), "misma-clave-3").expect(409);
    expect(response.body.error.code).toBe("clave_reutilizada");
  });

  test("exige la clave de la solicitud", async () => {
    const response = await request(app)
      .post("/reservas")
      .set("Authorization", `Bearer ${await nuevaCuenta()}`)
      .send(visita())
      .expect(400);
    expect(response.body.error.details.clave).toBeDefined();
  });
});

describe("concurrencia en PostgreSQL", () => {
  test("solicitudes simultáneas de varias cuentas no solapan plazas", async () => {
    // 20 cuentas compiten por 5 plazas. Las inserciones concurrentes pueden interbloquearse en la
    // restricción de exclusión; la API reintenta y nadie recibe un error 500.
    const tokens = await Promise.all(Array.from({ length: 20 }, () => nuevaCuenta()));
    const respuestas = await Promise.all(tokens.map((token) => solicitar(token)));
    const estados = respuestas.map((r) => r.status);
    expect(estados.filter((estado) => estado === 201)).toHaveLength(5);
    expect(estados.filter((estado) => estado === 409)).toHaveLength(15);
    expect(respuestas.filter((r) => r.status === 409).every((r) => r.body.error.code === "sin_cupo")).toBe(true);

    const plazas = respuestas.filter((r) => r.status === 201).map((r) => r.body.reserva.plaza.id);
    expect(new Set(plazas).size).toBe(5);
    expect(await db.reserva.count()).toBe(5);
  });

  test("una cuenta no obtiene dos reservas superpuestas aunque las pida a la vez", async () => {
    const token = await nuevaCuenta();
    const respuestas = await Promise.all([
      solicitar(token, visita()),
      solicitar(token, visita({ llegada: "10:00", salida: "13:00" })),
      solicitar(token, visita({ llegada: "11:00", salida: "11:30" })),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(respuestas.filter((r) => r.status === 409).every((r) => r.body.error.code === "reserva_superpuesta")).toBe(true);
    expect(await db.reserva.count()).toBe(1);
  });

  test("se admiten intervalos contiguos en la misma plaza y cuenta", async () => {
    const token = await nuevaCuenta();
    const manana = await solicitar(token, visita({ llegada: "09:00", salida: "12:00" })).expect(201);
    const tarde = await solicitar(token, visita({ llegada: "12:00", salida: "14:00" })).expect(201);
    expect(tarde.body.reserva.plaza.id).toBe(manana.body.reserva.plaza.id);
  });

  test("la base rechaza solapes por plaza y por vehículo aunque se salte la API", async () => {
    const token = await nuevaCuenta();
    const { reserva } = (await solicitar(token).expect(201)).body;
    const original = await db.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    const otraCuenta = await db.cuenta.findFirstOrThrow({ where: { id: { not: original.cuentaId } }, include: { vehiculos: true } });

    const base = { ...original, id: undefined, creadaEn: undefined, canceladaEn: undefined };
    // Misma plaza, otra cuenta y otro vehículo.
    await expect(
      db.reserva.create({
        data: { ...base, cuentaId: otraCuenta.id, vehiculoId: otraCuenta.vehiculos[0].id, claveIdempotencia: "directa-1" },
      }),
    ).rejects.toMatchObject({ code: "P2039" });
    // Mismo vehículo en otra plaza.
    const otraPlaza = await db.plaza.findFirstOrThrow({ where: { id: { not: original.plazaId } } });
    await expect(
      db.reserva.create({ data: { ...base, cuentaId: otraCuenta.id, plazaId: otraPlaza.id, claveIdempotencia: "directa-2" } }),
    ).rejects.toMatchObject({ code: "P2039" });
  });
});

describe("consulta", () => {
  test("lista las reservas vigentes de la cuenta y permite ver una propia", async () => {
    const token = await nuevaCuenta();
    const { reserva } = (await solicitar(token).expect(201)).body;
    await solicitar(await nuevaCuenta()).expect(201);

    const vigentes = await request(app).get("/reservas/vigentes").set("Authorization", `Bearer ${token}`).expect(200);
    expect(vigentes.body.reservas.map((r) => r.id)).toEqual([reserva.id]);
    await request(app).get(`/reservas/${reserva.id}`).set("Authorization", `Bearer ${token}`).expect(200);
    await request(app).get(`/reservas/${reserva.id}`).set("Authorization", `Bearer ${await nuevaCuenta()}`).expect(404);
  });
});
