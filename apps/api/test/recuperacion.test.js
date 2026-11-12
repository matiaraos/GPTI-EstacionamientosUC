import request from "supertest";
import { createApp } from "../dist/app.js";
import { createClock, createMailer, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
const clock = createClock();
const mailer = createMailer();
const app = createApp({ config: testConfig, db, clock, mailer });
const datos = datosRegistro("1");

beforeEach(async () => {
  await resetDatabase(db);
  mailer.enviados.length = 0;
  clock.set("2026-11-16T12:00:00.000Z");
});

afterAll(() => db.$disconnect());

/** Solicita la recuperación y devuelve el token del enlace enviado por correo. */
async function solicitarEnlace(correo = datos.correo) {
  await request(app).post("/auth/recuperacion").send({ correo }).expect(202);
  const ultimo = mailer.enviados.at(-1);
  const enlace = /miestacionamientouc:\/\/restablecer\?token=(\S+)/.exec(ultimo.texto);
  return decodeURIComponent(enlace[1]);
}

const confirmar = (token, contrasena = "contrasena-nueva") =>
  request(app).post("/auth/recuperacion/confirmar").send({ token, contrasena });

const iniciar = (contrasena) => request(app).post("/auth/sesion").send({ correo: datos.correo, contrasena });

describe("recuperación por correo", () => {
  test("un enlace válido permite cambiar la contraseña una vez", async () => {
    await registrarEIniciar(app, datos);
    const token = await solicitarEnlace("  PERSONA1@demo.uc.cl ");
    expect(mailer.enviados).toHaveLength(1);
    expect(mailer.enviados[0].para).toBe(datos.correo);
    expect(mailer.enviados[0].texto).toContain("vence a las 09:30 del 2026-11-16");

    const response = await confirmar(token).expect(200);
    expect(response.body.mensaje).toMatch(/contraseña se actualizó/);
    await iniciar("contrasena-nueva").expect(201);
    await iniciar(datos.contrasena).expect(401);

    const reutilizado = await confirmar(token, "otra-contrasena").expect(400);
    expect(reutilizado.body.error.code).toBe("enlace_usado");
    await iniciar("otra-contrasena").expect(401);
  });

  test("solo se guarda el hash del token", async () => {
    await registrarEIniciar(app, datos);
    const token = await solicitarEnlace();
    const filas = await db.recuperacion.findMany();
    expect(filas).toHaveLength(1);
    expect(filas[0].hashToken).not.toBe(token);
    expect(filas[0].hashToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test("un enlace vencido se rechaza", async () => {
    await registrarEIniciar(app, datos);
    const token = await solicitarEnlace();
    clock.advance(30 * 60_000);
    const response = await confirmar(token).expect(400);
    expect(response.body.error.code).toBe("enlace_vencido");
    await iniciar(datos.contrasena).expect(201);
  });

  test("un enlace inventado se rechaza", async () => {
    const response = await confirmar("token-inventado-que-no-existe").expect(400);
    expect(response.body.error.code).toBe("enlace_invalido");
  });

  test("un correo desconocido recibe la misma respuesta pública y no se envía nada", async () => {
    await registrarEIniciar(app, datos);
    const conocida = await request(app).post("/auth/recuperacion").send({ correo: datos.correo }).expect(202);
    const desconocida = await request(app).post("/auth/recuperacion").send({ correo: "nadie@demo.uc.cl" }).expect(202);
    const externa = await request(app).post("/auth/recuperacion").send({ correo: "alguien@gmail.com" }).expect(202);
    expect(desconocida.body).toEqual(conocida.body);
    expect(externa.body).toEqual(conocida.body);
    expect(mailer.enviados.map((correo) => correo.para)).toEqual([datos.correo]);
    expect(await db.recuperacion.count()).toBe(1);
  });

  test("una cuenta desactivada no recibe enlace", async () => {
    await registrarEIniciar(app, datos);
    await db.cuenta.update({ where: { correo: datos.correo }, data: { activa: false } });
    await request(app).post("/auth/recuperacion").send({ correo: datos.correo }).expect(202);
    expect(mailer.enviados).toHaveLength(0);
  });

  test("cambiar la contraseña cierra las sesiones abiertas y anula otros enlaces", async () => {
    const token = await registrarEIniciar(app, datos);
    const primero = await solicitarEnlace();
    const segundo = await solicitarEnlace();
    await confirmar(segundo).expect(200);
    await request(app).get("/cuenta").set("Authorization", `Bearer ${token}`).expect(401);
    const anulado = await confirmar(primero).expect(400);
    expect(anulado.body.error.code).toBe("enlace_usado");
  });

  test("confirmaciones simultáneas con el mismo enlace cambian la contraseña una sola vez", async () => {
    await registrarEIniciar(app, datos);
    const token = await solicitarEnlace();
    const respuestas = await Promise.all(
      ["clave-uno-123", "clave-dos-123", "clave-tres-123"].map((contrasena) => confirmar(token, contrasena)),
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 400, 400]);
  });

  test("una contraseña nueva inválida se informa por campo sin consumir el enlace", async () => {
    await registrarEIniciar(app, datos);
    const token = await solicitarEnlace();
    const response = await confirmar(token, "corta").expect(400);
    expect(response.body.error.details.contrasena).toMatch(/8 caracteres/);
    await confirmar(token).expect(200);
  });
});
