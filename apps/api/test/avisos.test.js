import request from "supertest";
import { createApp } from "../dist/app.js";
import { procesarAvisos } from "../dist/modules/avisos/envio.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { procesarVencimientos } from "../dist/modules/ranking/vencimientos.js";
import { createClock, createMailer, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const EN_CAMPUS = { latitud: -33.4975513178705, longitud: -70.61532261345947 };
const db = createTestDatabase();
// Lunes 16 de noviembre de 2026, 07:00 en Santiago (UTC−3).
const clock = createClock("2026-11-16T10:00:00.000Z");
const mailer = createMailer();
const app = createApp({ config: testConfig, db, clock, mailer });
let destinoId;
let qrs;
let siguiente = 1800;
let clave = 1;

/** Transporte push de prueba: registra los envíos y puede fallar a pedido. */
const notificador = {
  enviados: [],
  falla: false,
  async push(tokens, mensaje) {
    if (this.falla) return { ok: false, tokensInvalidos: [], error: "sin red" };
    this.enviados.push({ tokens, ...mensaje });
    return { ok: true, tokensInvalidos: tokens.filter((t) => t.includes("Invalido")) };
  },
};

const local = (hhmm) => clock.set(`2026-11-16T${String(Number(hhmm.slice(0, 2)) + 3).padStart(2, "0")}:${hhmm.slice(3)}:00.000Z`);
const conToken = (token, metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);
const enviar = () => procesarAvisos(db, clock(), { notificador, mailer });
const avisosDe = (cuentaId) => db.aviso.findMany({ where: { cuentaId }, orderBy: { id: "asc" } });

async function cuenta() {
  const datos = datosRegistro(String(siguiente++));
  const token = await registrarEIniciar(app, datos);
  const { id } = await db.cuenta.findUniqueOrThrow({ where: { correo: datos.correo } });
  return { token, id, correo: datos.correo };
}

const reservar = (token, cambios = {}, k = `avisos-${clave++}`) =>
  conToken(token, "post", "/reservas").set("Idempotency-Key", k).send({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId, ...cambios });

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  qrs = await sembrarPlazasDemo(db);
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
}, 30_000);

beforeEach(async () => {
  await db.aviso.deleteMany();
  await db.solicitudEspera.deleteMany();
  await db.ajusteRanking.deleteMany();
  await db.eventoReserva.deleteMany();
  await db.reserva.deleteMany();
  await db.bloqueClase.deleteMany();
  await db.canalAviso.deleteMany();
  mailer.enviados.length = 0;
  notificador.enviados.length = 0;
  notificador.falla = false;
  clock.set("2026-11-16T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

describe("resultado de la operación", () => {
  test("la confirmación se registra con la reserva e incluye fecha, horario y plaza", async () => {
    const { token, id } = await cuenta();
    const reserva = (await reservar(token).expect(201)).body.reserva;
    const avisos = await avisosDe(id);
    expect(avisos.map((a) => [a.tipo, a.estado])).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio_salida", "pendiente"],
    ]);
    expect(avisos[0]).toMatchObject({ reservaId: reserva.id, titulo: "Reserva confirmada" });
    expect(avisos[0].cuerpo).toMatch(/lunes, 16 de noviembre, 09:00–12:00, plaza A1 en Est\. Subterráneo Centro de innovación/);
    expect(avisos[1].programadoEn.toISOString()).toBe(reserva.fin);
  });

  test("cancelación, cambio y falta de disponibilidad se comunican según el resultado real", async () => {
    const { token, id } = await cuenta();
    const reserva = (await reservar(token).expect(201)).body.reserva;
    const cambio = (await conToken(token, "post", `/reservas/${reserva.id}/cambiar`).set("Idempotency-Key", `avisos-cambio-${clave++}`)
      .send({ fecha: "2026-11-16", llegada: "10:00", salida: "12:00", destinoId }).expect(201)).body.reserva;
    await conToken(token, "post", `/reservas/${cambio.id}/cancelar`).expect(200);
    await conToken(token, "post", `/reservas/${cambio.id}/cancelar`).expect(200);

    // Sin cupo: se llena el horario y la cuenta reintenta la misma solicitud.
    for (let i = 0; i < 5; i++) await reservar((await cuenta()).token, { llegada: "13:00", salida: "15:00" }).expect(201);
    const k = `avisos-sin-cupo-${clave++}`;
    await reservar(token, { llegada: "13:00", salida: "15:00" }, k).expect(409);
    await reservar(token, { llegada: "13:00", salida: "15:00" }, k).expect(409);

    const tipos = (await avisosDe(id)).map((a) => `${a.tipo}:${a.estado}`);
    expect(tipos).toEqual([
      "confirmacion:pendiente",
      "recordatorio_salida:cancelado",
      "cambio:pendiente",
      "recordatorio_salida:cancelado",
      "cancelacion:pendiente",
      "sin_cupo:pendiente",
    ]);
  });

  test("un aviso no queda registrado si la operación falla", async () => {
    const { token, id } = await cuenta();
    const reserva = (await reservar(token).expect(201)).body.reserva;
    for (let i = 0; i < 4; i++) await reservar((await cuenta()).token, { llegada: "13:00", salida: "15:00" }).expect(201);
    await reservar((await cuenta()).token, { llegada: "13:00", salida: "15:00" }).expect(201);
    await conToken(token, "post", `/reservas/${reserva.id}/cambiar`).set("Idempotency-Key", `avisos-cambio-${clave++}`)
      .send({ fecha: "2026-11-16", llegada: "13:00", salida: "15:00", destinoId }).expect(409);
    const avisos = await avisosDe(id);
    expect(avisos.map((a) => `${a.tipo}:${a.estado}`)).toEqual(["confirmacion:pendiente", "recordatorio_salida:pendiente"]);
  });
});

describe("recordatorios", () => {
  async function conClase(token, fin) {
    const sala = await db.destino.findFirstOrThrow({ where: { nombre: "B25", tipo: "sala" } });
    await conToken(token, "post", "/horario/bloques").send({ diaSemana: 1, inicio: "09:00", fin, destinoId: sala.id, titulo: "Clase" }).expect(201);
  }

  test("al terminar la última clase y a la salida declarada; si coinciden, uno solo", async () => {
    const a = await cuenta();
    await conClase(a.token, "11:30");
    await reservar(a.token, { destinoId: null }).expect(201);
    const recordatorios = (await avisosDe(a.id)).filter((x) => x.tipo.startsWith("recordatorio"));
    expect(recordatorios.map((x) => [x.tipo, x.programadoEn.toISOString()])).toEqual([
      ["recordatorio_clase", "2026-11-16T14:30:00.000Z"],
      ["recordatorio_salida", "2026-11-16T15:00:00.000Z"],
    ]);

    const b = await cuenta();
    await conClase(b.token, "12:00");
    await reservar(b.token, { destinoId: null }).expect(201);
    expect((await avisosDe(b.id)).filter((x) => x.tipo.startsWith("recordatorio")).map((x) => x.tipo)).toEqual(["recordatorio_salida"]);
  });

  test("un recordatorio cancelado no se entrega después del check-out ni de una ausencia", async () => {
    const a = await cuenta();
    const reserva = (await reservar(a.token).expect(201)).body.reserva;
    const ausente = await cuenta();
    await reservar(ausente.token).expect(201);
    local("09:00");
    await conToken(a.token, "post", `/reservas/${reserva.id}/entrada`).send({ qr: qrs.find((q) => q.codigo === "A1").qr, ...EN_CAMPUS }).expect(201);
    local("10:00");
    await procesarVencimientos(db, clock(), testConfig.reservas, testConfig.ranking);
    local("11:00");
    await conToken(a.token, "post", `/reservas/${reserva.id}/salida`).send({ qr: qrs.find((q) => q.codigo === "A1").qr }).expect(201);
    local("12:30");
    const envio = await enviar();
    const recordatorios = await db.aviso.findMany({ where: { tipo: { in: ["recordatorio_clase", "recordatorio_salida"] } } });
    expect(recordatorios.map((x) => x.estado)).toEqual(["cancelado", "cancelado"]);
    expect(envio.enviados).toHaveLength(2);
    expect(mailer.enviados.every((m) => !m.asunto.includes("salida"))).toBe(true);
  });
});

describe("envío", () => {
  test("usa la notificación de la app y, si falla, el correo institucional", async () => {
    const a = await cuenta();
    await conToken(a.token, "post", "/avisos/canales").send({ token: "ExponentPushToken[prueba-a]", plataforma: "android" }).expect(204);
    await reservar(a.token).expect(201);
    const b = await cuenta();
    await reservar(b.token).expect(201);

    const resultado = await enviar();
    expect(resultado.enviados).toHaveLength(2);
    expect(notificador.enviados).toEqual([expect.objectContaining({ tokens: ["ExponentPushToken[prueba-a]"], titulo: "Reserva confirmada" })]);
    expect(mailer.enviados).toEqual([expect.objectContaining({ para: b.correo, asunto: "MiEstacionamientoUC · Reserva confirmada" })]);

    notificador.falla = true;
    await conToken(a.token, "post", `/reservas/${(await db.reserva.findFirstOrThrow({ where: { cuentaId: a.id } })).id}/cancelar`).expect(200);
    await enviar();
    const cancelacion = await db.aviso.findFirstOrThrow({ where: { cuentaId: a.id, tipo: "cancelacion" } });
    expect(cancelacion).toMatchObject({ estado: "enviado", canal: "correo", ultimoError: "push: sin red" });
  });

  test("las fallas se reintentan sin duplicar avisos ni cambiar la reserva", async () => {
    const a = await cuenta();
    const reserva = (await reservar(a.token).expect(201)).body.reserva;
    const original = mailer.enviar;
    mailer.enviar = async () => {
      throw new Error("SMTP caído");
    };
    try {
      expect((await enviar()).reintentos).toHaveLength(1);
      expect((await enviar()).reintentos).toHaveLength(0); // aún no llega la hora del reintento
      clock.advance(60_000);
      expect((await enviar()).reintentos).toHaveLength(1);
      clock.advance(120_000);
      expect((await enviar()).fallidos).toHaveLength(1);
    } finally {
      mailer.enviar = original;
    }
    const aviso = await db.aviso.findFirstOrThrow({ where: { cuentaId: a.id, tipo: "confirmacion" } });
    expect(aviso).toMatchObject({ estado: "fallido", intentos: 3 });
    expect(await db.aviso.count({ where: { cuentaId: a.id, tipo: "confirmacion" } })).toBe(1);
    expect(await db.reserva.findUniqueOrThrow({ where: { id: reserva.id } })).toMatchObject({ estado: "confirmada" });
    // La persona igual puede consultar su reserva y el aviso en la bandeja.
    const bandeja = await conToken(a.token, "get", "/avisos").expect(200);
    expect(bandeja.body.avisos[0]).toMatchObject({ tipo: "confirmacion", estado: "fallido", reservaId: reserva.id });
    expect(bandeja.body.programados.map((p) => p.tipo)).toEqual(["recordatorio_salida"]);
  });

  test("dos envíos simultáneos entregan cada aviso una sola vez", async () => {
    const a = await cuenta();
    await reservar(a.token).expect(201);
    const [r1, r2] = await Promise.all([enviar(), enviar()]);
    expect(r1.enviados.length + r2.enviados.length).toBe(1);
    expect(mailer.enviados).toHaveLength(1);
  });

  test("un token inválido se desactiva y se usa el correo la próxima vez", async () => {
    const a = await cuenta();
    await conToken(a.token, "post", "/avisos/canales").send({ token: "ExponentPushToken[Invalido]", plataforma: "ios" }).expect(204);
    await conToken(a.token, "post", "/avisos/canales").send({ token: "no-es-un-token", plataforma: "ios" }).expect(400);
    await reservar(a.token).expect(201);
    await enviar();
    expect((await db.canalAviso.findFirstOrThrow({ where: { cuentaId: a.id } })).activo).toBe(false);
  });

  test("una plaza obtenida desde la lista de espera se avisa", async () => {
    const ocupantes = [];
    for (let i = 0; i < 5; i++) {
      const c = await cuenta();
      ocupantes.push({ ...c, reserva: (await reservar(c.token).expect(201)).body.reserva });
    }
    const espera = await cuenta();
    await conToken(espera.token, "post", "/esperas").set("Idempotency-Key", `avisos-espera-${clave++}`)
      .send({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId, consentimiento: true }).expect(201);
    await conToken(ocupantes[0].token, "post", `/reservas/${ocupantes[0].reserva.id}/cancelar`).expect(200);
    expect((await avisosDe(espera.id)).map((a) => a.tipo)).toEqual(["espera_asignada", "recordatorio_salida"]);
  });
});
