import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../dist/app.js";
import {
  esPatenteChilenaValida,
  normalizarCorreo,
  normalizarPatente,
} from "../dist/modules/cuentas/normalizacion.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
const clock = createClock();
const app = createApp({ config: testConfig, db, clock });

beforeEach(async () => {
  await resetDatabase(db);
  clock.set("2026-11-16T12:00:00.000Z");
});

afterAll(() => db.$disconnect());

const contar = async () => ({ cuentas: await db.cuenta.count(), vehiculos: await db.vehiculo.count() });

describe("normalización", () => {
  test("normaliza correo y patente", () => {
    expect(normalizarCorreo("  Persona@Demo.UC.cl ")).toBe("persona@demo.uc.cl");
    expect(normalizarPatente(" bc-df·12 ")).toBe("BCDF12");
    expect(normalizarPatente("ab.12.34")).toBe("AB1234");
  });

  test("acepta los formatos chilenos de automóvil y rechaza el resto", () => {
    for (const valida of ["AB1234", "BCDF12", "ZZZZ99"]) {
      expect(esPatenteChilenaValida(valida)).toBe(true);
    }
    // Vocales, M, N y Q no existen en el formato actual; largo o formato incorrecto.
    for (const invalida of ["ABCD12", "BCMN12", "BCDQ12", "AB123", "1234AB", "AB12345", ""]) {
      expect(esPatenteChilenaValida(invalida)).toBe(false);
    }
  });
});

describe("registro", () => {
  test("un registro válido permite iniciar sesión y consultar la cuenta", async () => {
    const datos = { correo: " Ana.Perez@DEMO.uc.cl ", contrasena: "contrasena-segura", patente: "bc-df 12" };
    const registro = await request(app).post("/auth/registro").send(datos).expect(201);
    expect(registro.body.cuenta).toMatchObject({
      correo: "ana.perez@demo.uc.cl",
      rol: "usuario",
      vehiculos: [{ patente: "BCDF12" }],
    });
    expect(registro.body.cuenta).not.toHaveProperty("hashContrasena");

    const guardada = await db.cuenta.findUniqueOrThrow({ where: { correo: "ana.perez@demo.uc.cl" } });
    expect(guardada.hashContrasena).not.toContain("contrasena-segura");
    expect(await bcrypt.compare("contrasena-segura", guardada.hashContrasena)).toBe(true);

    const sesion = await request(app)
      .post("/auth/sesion")
      .send({ correo: "ANA.PEREZ@demo.uc.cl", contrasena: "contrasena-segura" })
      .expect(201);
    expect(typeof sesion.body.token).toBe("string");

    const cuenta = await request(app).get("/cuenta").set("Authorization", `Bearer ${sesion.body.token}`).expect(200);
    expect(cuenta.body.cuenta.vehiculos).toEqual([expect.objectContaining({ patente: "BCDF12" })]);
  });

  test("rechaza un correo externo sin crear registros", async () => {
    const response = await request(app)
      .post("/auth/registro")
      .send({ ...datosRegistro(), correo: "persona@gmail.com" })
      .expect(400);
    expect(response.body.error.code).toBe("datos_invalidos");
    expect(response.body.error.details.correo).toMatch(/@demo\.uc\.cl/);
    expect(await contar()).toEqual({ cuentas: 0, vehiculos: 0 });
  });

  test("rechaza una patente inválida sin crear registros", async () => {
    const response = await request(app)
      .post("/auth/registro")
      .send({ ...datosRegistro(), patente: "ABCD12" })
      .expect(400);
    expect(response.body.error.details.patente).toBeDefined();
    expect(await contar()).toEqual({ cuentas: 0, vehiculos: 0 });
  });

  test("rechaza contraseñas cortas y campos faltantes con un mensaje por campo", async () => {
    const response = await request(app).post("/auth/registro").send({ contrasena: "corta" }).expect(400);
    expect(Object.keys(response.body.error.details).sort()).toEqual(["contrasena", "correo", "patente"]);
  });

  test("rechaza un correo duplicado, aunque cambien mayúsculas, sin registros parciales", async () => {
    await request(app).post("/auth/registro").send(datosRegistro("1")).expect(201);
    const response = await request(app)
      .post("/auth/registro")
      .send({ ...datosRegistro("2"), correo: "PERSONA1@demo.uc.cl" })
      .expect(409);
    expect(response.body.error.code).toBe("correo_registrado");
    expect(await contar()).toEqual({ cuentas: 1, vehiculos: 1 });
  });

  test("rechaza una patente ya registrada sin crear la segunda cuenta", async () => {
    await request(app).post("/auth/registro").send(datosRegistro("1")).expect(201);
    const response = await request(app)
      .post("/auth/registro")
      .send({ ...datosRegistro("2"), patente: datosRegistro("1").patente.toLowerCase() })
      .expect(409);
    expect(response.body.error.code).toBe("patente_registrada");
    expect(await contar()).toEqual({ cuentas: 1, vehiculos: 1 });
  });

  test("registros simultáneos con el mismo correo dejan una sola cuenta", async () => {
    const intentos = await Promise.all(
      ["1", "2", "3"].map((sufijo) =>
        request(app)
          .post("/auth/registro")
          .send({ ...datosRegistro(sufijo), correo: "misma@demo.uc.cl" }),
      ),
    );
    expect(intentos.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await contar()).toEqual({ cuentas: 1, vehiculos: 1 });
  });
});

describe("inicio de sesión", () => {
  test("credenciales incorrectas y correos desconocidos reciben el mismo error genérico", async () => {
    await request(app).post("/auth/registro").send(datosRegistro()).expect(201);

    const contrasenaMala = await request(app)
      .post("/auth/sesion")
      .send({ correo: datosRegistro().correo, contrasena: "otra-contrasena" })
      .expect(401);
    const correoDesconocido = await request(app)
      .post("/auth/sesion")
      .send({ correo: "nadie@demo.uc.cl", contrasena: "otra-contrasena" })
      .expect(401);

    expect(contrasenaMala.body).toEqual(correoDesconocido.body);
    expect(contrasenaMala.body.error.code).toBe("credenciales_invalidas");
    expect(await db.sesion.count()).toBe(0);
  });

  test("una cuenta desactivada no puede iniciar sesión", async () => {
    await request(app).post("/auth/registro").send(datosRegistro()).expect(201);
    await db.cuenta.updateMany({ data: { activa: false } });
    await request(app)
      .post("/auth/sesion")
      .send({ correo: datosRegistro().correo, contrasena: datosRegistro().contrasena })
      .expect(401);
  });

  test("solo se guarda el hash del token", async () => {
    const token = await registrarEIniciar(app);
    const sesion = await db.sesion.findFirstOrThrow();
    expect(sesion.hashToken).not.toBe(token);
    expect(sesion.hashToken).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("sesiones", () => {
  test("cerrar sesión invalida solo esa sesión", async () => {
    const datos = datosRegistro();
    const tokenA = await registrarEIniciar(app, datos);
    const tokenB = (
      await request(app).post("/auth/sesion").send({ correo: datos.correo, contrasena: datos.contrasena }).expect(201)
    ).body.token;

    await request(app).delete("/auth/sesion").set("Authorization", `Bearer ${tokenA}`).expect(204);
    const rechazo = await request(app).get("/cuenta").set("Authorization", `Bearer ${tokenA}`).expect(401);
    expect(rechazo.body.error.code).toBe("sesion_invalida");
    await request(app).delete("/auth/sesion").set("Authorization", `Bearer ${tokenA}`).expect(401);

    await request(app).get("/cuenta").set("Authorization", `Bearer ${tokenB}`).expect(200);
  });

  test("una sesión vencida se rechaza", async () => {
    const token = await registrarEIniciar(app);
    clock.advance(testConfig.auth.sessionTtlHours * 3_600_000);
    await request(app).get("/cuenta").set("Authorization", `Bearer ${token}`).expect(401);
  });

  test("sin token o con un token inventado se rechaza", async () => {
    await request(app).get("/cuenta").expect(401);
    await request(app).get("/cuenta").set("Authorization", "Bearer inventado").expect(401);
    await request(app).get("/cuenta").set("Authorization", "Basic abc").expect(401);
  });
});

describe("permisos administrativos", () => {
  test("la API rechaza operaciones administrativas de cuentas comunes y las permite a un admin", async () => {
    const tokenUsuario = await registrarEIniciar(app, datosRegistro("1"));
    const denegado = await request(app)
      .get("/admin/cuentas")
      .set("Authorization", `Bearer ${tokenUsuario}`)
      .expect(403);
    expect(denegado.body.error.code).toBe("acceso_denegado");

    const tokenAdmin = await registrarEIniciar(app, datosRegistro("2"));
    await db.cuenta.update({ where: { correo: datosRegistro("2").correo }, data: { rol: "admin" } });
    const lista = await request(app).get("/admin/cuentas").set("Authorization", `Bearer ${tokenAdmin}`).expect(200);
    expect(lista.body.cuentas).toHaveLength(2);
    expect(lista.body.cuentas[0]).not.toHaveProperty("hashContrasena");
  });
});
