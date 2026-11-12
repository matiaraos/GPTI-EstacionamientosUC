import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { procesarVencimientos } from "../dist/modules/ranking/vencimientos.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const EN_CAMPUS = { latitud: -33.4975513178705, longitud: -70.61532261345947 };
const db = createTestDatabase();
// Lunes 16 de noviembre de 2026, 07:00 en Santiago (UTC−3).
const clock = createClock("2026-11-16T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
let destinoId;
let qrs;
let admin;
let siguiente = 700;

const local = (hhmm) => clock.set(`2026-11-16T${String(Number(hhmm.slice(0, 2)) + 3).padStart(2, "0")}:${hhmm.slice(3)}:00.000Z`);
const procesar = () => procesarVencimientos(db, clock(), testConfig.reservas, testConfig.ranking);
const qrDe = (codigo) => qrs.find((p) => p.codigo === codigo).qr;
const conToken = (token, metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);

async function cuentaConReserva(llegada = "09:00", salida = "12:00") {
  const token = await registrarEIniciar(app, datosRegistro(String(siguiente++)));
  const { body } = await conToken(token, "post", "/reservas")
    .set("Idempotency-Key", `ranking-${siguiente++}`)
    .send({ fecha: "2026-11-16", llegada, salida, destinoId })
    .expect(201);
  return { token, reserva: body.reserva };
}

const entrar = (token, reserva) => conToken(token, "post", `/reservas/${reserva.id}/entrada`).send({ qr: qrDe(reserva.plaza.codigo), ...EN_CAMPUS });
const salir = (token, reserva) => conToken(token, "post", `/reservas/${reserva.id}/salida`).send({ qr: qrDe(reserva.plaza.codigo) });
const ranking = async (token) => (await conToken(token, "get", "/ranking").expect(200)).body;

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  qrs = await sembrarPlazasDemo(db);
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  admin = await registrarEIniciar(app, datosRegistro("1"));
  await db.cuenta.update({ where: { correo: datosRegistro("1").correo }, data: { rol: "admin" } });
}, 30_000);

beforeEach(async () => {
  await db.ajusteRanking.deleteMany();
  await db.eventoReserva.deleteMany();
  await db.reserva.deleteMany();
  clock.set("2026-11-16T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

describe("ausencias y vencimientos", () => {
  test("una ausencia cambia el estado, libera la plaza y ajusta el puntaje una sola vez", async () => {
    const { token, reserva } = await cuentaConReserva();
    local("09:15");
    expect((await procesar()).ausentes).toEqual([]);
    local("09:16");
    expect((await procesar()).ausentes).toEqual([reserva.id]);
    expect((await procesar()).ausentes).toEqual([]);
    expect(await Promise.all([procesar(), procesar(), procesar()])).toEqual(Array(3).fill({ ausentes: [], vencidas: [] }));

    expect((await conToken(token, "get", `/reservas/${reserva.id}`).expect(200)).body.reserva.estado).toBe("ausente");
    const puntos = await ranking(token);
    expect(puntos.puntaje).toBe(90);
    expect(puntos.ajustes).toEqual([
      expect.objectContaining({ tipo: "ausencia", variacion: -10, reserva: expect.objectContaining({ id: reserva.id, plaza: "A1" }) }),
    ]);
    // La plaza quedó libre para otra persona en el resto del intervalo.
    const otra = await cuentaConReserva("10:00", "12:00");
    expect(otra.reserva.plaza.codigo).toBe("A1");
    // Ya no admite entrada ni cancelación.
    expect((await entrar(token, reserva).expect(409)).body.error.code).toBe("reserva_no_activa");
    expect((await conToken(token, "post", `/reservas/${reserva.id}/cancelar`).expect(409)).body.error.message).toMatch(/venció/);
  });

  test("un vencimiento de salida libera la capacidad y se distingue de una salida registrada", async () => {
    const vence = await cuentaConReserva("09:00", "10:00");
    const cumple = await cuentaConReserva("09:00", "10:00");
    local("09:00");
    await entrar(vence.token, vence.reserva).expect(201);
    await entrar(cumple.token, cumple.reserva).expect(201);
    local("10:05");
    await salir(cumple.token, cumple.reserva).expect(201);
    local("10:10");
    expect((await procesar()).vencidas).toEqual([]);
    local("10:11");
    expect(await procesar()).toEqual({ ausentes: [], vencidas: [vence.reserva.id] });
    expect(await procesar()).toEqual({ ausentes: [], vencidas: [] });

    const estados = await db.reserva.findMany({ where: { id: { in: [vence.reserva.id, cumple.reserva.id] } }, orderBy: { id: "asc" } });
    expect(estados.map((r) => r.estado)).toEqual(["vencida", "finalizada"]);
    expect((await ranking(vence.token)).puntaje).toBe(95);
    expect((await ranking(cumple.token)).ajustes).toEqual([expect.objectContaining({ tipo: "salida_a_tiempo", variacion: 1 })]);
    expect((await ranking(cumple.token)).puntaje).toBe(101);

    // El vencimiento libera el uso activo: la persona puede entrar a otra reserva y aún registrar la salida sin otro ajuste.
    await salir(vence.token, vence.reserva).expect(201);
    expect((await db.reserva.findUniqueOrThrow({ where: { id: vence.reserva.id } })).estado).toBe("vencida");
    expect((await ranking(vence.token)).ajustes).toHaveLength(1);
  });

  test("una salida tardía antes del proceso se registra como salida con su ajuste", async () => {
    const { token, reserva } = await cuentaConReserva("09:00", "10:00");
    local("09:00");
    await entrar(token, reserva).expect(201);
    local("10:30");
    await salir(token, reserva).expect(201);
    await salir(token, reserva).expect(200);
    expect(await procesar()).toEqual({ ausentes: [], vencidas: [] });
    const puntos = await ranking(token);
    expect(puntos.ajustes.map((a) => [a.tipo, a.variacion])).toEqual([["salida_tardia", -3]]);
  });

  test("un error de lectura no sanciona", async () => {
    const { token, reserva } = await cuentaConReserva();
    local("09:00");
    await conToken(token, "post", `/reservas/${reserva.id}/entrada`).send({ qr: "basura", ...EN_CAMPUS }).expect(400);
    await conToken(token, "post", `/reservas/${reserva.id}/entrada`).send({ qr: qrDe("B1"), ...EN_CAMPUS }).expect(409);
    expect((await ranking(token)).ajustes).toEqual([]);
    await entrar(token, reserva).expect(201);
    local("12:00");
    await salir(token, reserva).expect(201);
    expect((await ranking(token)).ajustes.map((a) => a.tipo)).toEqual(["salida_a_tiempo"]);
  });
});

describe("rectificación administrativa", () => {
  test("el mal uso solo se sanciona con una rectificación justificada de administración", async () => {
    const { token, reserva } = await cuentaConReserva();
    const cuentaId = (await conToken(token, "get", "/cuenta").expect(200)).body.cuenta.id;
    const ruta = `/admin/cuentas/${cuentaId}/ranking/rectificaciones`;
    const body = { variacion: -15, motivo: "Estacionó fuera de la plaza asignada (verificado en terreno).", reservaId: reserva.id };

    await conToken(token, "post", ruta).set("Idempotency-Key", "rectificacion-1").send(body).expect(403);
    const sinMotivo = await conToken(admin, "post", ruta).set("Idempotency-Key", "rectificacion-0").send({ variacion: -15, motivo: "x" }).expect(400);
    expect(sinMotivo.body.error.details.motivo).toBeDefined();

    await conToken(admin, "post", ruta).set("Idempotency-Key", "rectificacion-1").send(body).expect(201);
    await conToken(admin, "post", ruta).set("Idempotency-Key", "rectificacion-1").send(body).expect(200);
    const puntos = await ranking(token);
    expect(puntos.puntaje).toBe(85);
    expect(puntos.ajustes).toEqual([
      expect.objectContaining({ tipo: "rectificacion", motivo: body.motivo, rectificadoPor: "Administración", reserva: expect.objectContaining({ id: reserva.id }) }),
    ]);
    const vistaAdmin = await conToken(admin, "get", `/admin/cuentas/${cuentaId}/ranking`).expect(200);
    expect(vistaAdmin.body.ajustes[0].rectificadoPor).toBe(datosRegistro("1").correo);
    const cuentas = await conToken(admin, "get", "/admin/cuentas").expect(200);
    expect(cuentas.body.cuentas.find((c) => c.id === cuentaId).puntaje).toBe(85);
  });

  test("el proceso manual de vencimientos es solo para administración", async () => {
    const { token, reserva } = await cuentaConReserva();
    await conToken(token, "post", "/admin/procesos/vencimientos").expect(403);
    local("10:00");
    const response = await conToken(admin, "post", "/admin/procesos/vencimientos").expect(200);
    expect(response.body.ausentes).toEqual([reserva.id]);
  });
});
