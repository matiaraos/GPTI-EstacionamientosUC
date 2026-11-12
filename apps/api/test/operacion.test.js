import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { procesarVencimientos } from "../dist/modules/ranking/vencimientos.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const EN_CAMPUS = { latitud: -33.4975513178705, longitud: -70.61532261345947 };
const db = createTestDatabase();
const clock = createClock("2026-11-16T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
let destinoId;
let qrs;
let admin;
let siguiente = 1200;
let clave = 1;

const local = (hhmm) => clock.set(`2026-11-16T${String(Number(hhmm.slice(0, 2)) + 3).padStart(2, "0")}:${hhmm.slice(3)}:00.000Z`);
const conToken = (token, metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);
const comoAdmin = (metodo, ruta) => conToken(admin, metodo, ruta);
const qrDe = (codigo) => qrs.find((p) => p.codigo === codigo).qr;
const plaza = (codigo) => db.plaza.findFirstOrThrow({ where: { codigo } });

async function reservar(llegada = "09:00", salida = "12:00") {
  const token = await registrarEIniciar(app, datosRegistro(String(siguiente++)));
  const { body } = await conToken(token, "post", "/reservas")
    .set("Idempotency-Key", `operacion-${clave++}`)
    .send({ fecha: "2026-11-16", llegada, salida, destinoId })
    .expect(201);
  return { token, reserva: body.reserva };
}

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  qrs = await sembrarPlazasDemo(db);
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  admin = await registrarEIniciar(app, datosRegistro("1"));
  await db.cuenta.update({ where: { correo: datosRegistro("1").correo }, data: { rol: "admin" } });
}, 30_000);

beforeEach(async () => {
  await db.solicitudEspera.deleteMany();
  await db.ajusteRanking.deleteMany();
  await db.bloqueoPlaza.deleteMany();
  await db.incidente.deleteMany();
  await db.eventoReserva.deleteMany();
  await db.reserva.deleteMany();
  await db.plaza.updateMany({ data: { activa: true } });
  clock.set("2026-11-16T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

test("una cuenta común recibe rechazo", async () => {
  const { token, reserva } = await reservar();
  const a1 = await plaza("A1");
  for (const [metodo, ruta, body] of [
    ["get", "/admin/ocupacion"],
    ["get", "/admin/ocupacion/periodo"],
    ["get", "/admin/incidentes"],
    ["post", "/admin/incidentes", { plazaId: a1.id, descripcion: "Prueba de permisos" }],
    ["post", "/admin/incidentes/1/resolver", { resultado: "validado", motivo: "Prueba" }],
    ["post", "/admin/incidentes/1/cerrar", { motivo: "Prueba" }],
  ]) {
    const response = await conToken(token, metodo, ruta).send(body);
    expect([ruta, response.status]).toEqual([ruta, 403]);
  }
  expect(await db.incidente.count()).toBe(0);
  expect(reserva.estado).toBe("confirmada");
});

test("los totales de ocupación y del período coinciden con reservas y eventos", async () => {
  const enUso = await reservar();
  const reservada = await reservar();
  const b1 = await plaza("B1");
  const b2 = await plaza("B2");
  await comoAdmin("post", "/admin/bloqueos").send({ plazaId: b1.id, inicio: "2026-11-16T08:00", fin: "2026-11-16T13:00", motivo: "Mantención" }).expect(201);
  await comoAdmin("patch", `/admin/plazas/${b2.id}`).send({ activa: false }).expect(200);
  const cancelada = await reservar("14:00", "15:00");
  await conToken(cancelada.token, "post", `/reservas/${cancelada.reserva.id}/cancelar`).expect(200);

  local("09:00");
  await conToken(enUso.token, "post", `/reservas/${enUso.reserva.id}/entrada`).send({ qr: qrDe("A1"), ...EN_CAMPUS }).expect(201);
  local("10:00");
  const ahora = await comoAdmin("get", "/admin/ocupacion").expect(200);
  expect(ahora.body.totales).toEqual({ libre: 1, reservada: 1, en_uso: 1, bloqueada: 1, inactiva: 1 });
  expect(Object.fromEntries(ahora.body.plazas.map((p) => [p.codigo, p.estado]))).toEqual({
    A1: "en_uso",
    A2: "reservada",
    B1: "bloqueada",
    B2: "inactiva",
    B3: "libre",
  });
  // Antes de la llegada, A2 todavía está libre.
  const temprano = await comoAdmin("get", "/admin/ocupacion?en=2026-11-16T08:00").expect(200);
  expect(temprano.body.plazas.find((p) => p.codigo === "A2").estado).toBe("libre");

  // A2 no registra llegada (ausente); A1 sale a tiempo.
  await procesarVencimientos(db, clock(), testConfig.reservas, testConfig.ranking);
  local("11:30");
  await conToken(enUso.token, "post", `/reservas/${enUso.reserva.id}/salida`).send({ qr: qrDe("A1") }).expect(201);

  const periodo = await comoAdmin("get", "/admin/ocupacion/periodo?desde=2026-11-16&hasta=2026-11-16").expect(200);
  expect(periodo.body.reservas).toEqual({ total: 3, confirmada: 0, en_uso: 0, finalizada: 1, cancelada: 1, ausente: 1, vencida: 0 });
  expect(periodo.body.eventos).toEqual({ entradas: 1, salidas: 1 });
  expect(periodo.body.salidasATiempo).toBe(1);
  // Contraste directo con la base.
  expect(periodo.body.reservas.total).toBe(await db.reserva.count());
  expect(periodo.body.eventos.entradas + periodo.body.eventos.salidas).toBe(await db.eventoReserva.count());
  const otroDia = await comoAdmin("get", "/admin/ocupacion/periodo?desde=2026-11-17").expect(200);
  expect(otroDia.body.reservas.total).toBe(0);
});

describe("incidentes", () => {
  const ranking = async (token) => (await conToken(token, "get", "/ranking").expect(200)).body;

  test("un incidente sin validar no genera una sanción", async () => {
    const { token, reserva } = await reservar();
    const reporte = await conToken(token, "post", "/incidentes").send({ reservaId: reserva.id, descripcion: "Mi plaza estaba ocupada por otro auto" }).expect(201);
    expect(reporte.body.incidente.estado).toBe("pendiente");
    const a1 = await plaza("A1");
    await comoAdmin("post", "/admin/incidentes").send({ plazaId: a1.id, reservaId: reserva.id, descripcion: "Vehículo fuera de la demarcación" }).expect(201);
    expect((await ranking(token)).ajustes).toEqual([]);
    const pendientes = await comoAdmin("get", "/admin/incidentes?estado=pendiente").expect(200);
    expect(pendientes.body.incidentes).toHaveLength(2);
    const ocupacion = await comoAdmin("get", "/admin/ocupacion").expect(200);
    expect(ocupacion.body.plazas.find((p) => p.codigo === "A1").incidentesAbiertos).toBe(2);

    // Descartar no sanciona y no admite sanción.
    const id = pendientes.body.incidentes[0].id;
    const invalido = await comoAdmin("post", `/admin/incidentes/${id}/resolver`).send({ resultado: "descartado", motivo: "No se confirmó", sancion: -10 }).expect(400);
    expect(invalido.body.error.details.resultado).toBeDefined();
    const descartado = await comoAdmin("post", `/admin/incidentes/${id}/resolver`).send({ resultado: "descartado", motivo: "No se confirmó en terreno" }).expect(200);
    expect(descartado.body.incidente).toMatchObject({ estado: "descartado", resueltoPor: datosRegistro("1").correo, motivoResolucion: "No se confirmó en terreno", sancion: null });
    expect((await ranking(token)).ajustes).toEqual([]);
  });

  test("validar registra responsable y motivo, sanciona una vez y bloquea hasta cerrar", async () => {
    const { token, reserva } = await reservar();
    const a1 = await plaza("A1");
    const { body } = await comoAdmin("post", "/admin/incidentes").send({ plazaId: a1.id, reservaId: reserva.id, descripcion: "Uso indebido de la plaza" }).expect(201);
    const ruta = `/admin/incidentes/${body.incidente.id}`;
    const resuelto = await comoAdmin("post", `${ruta}/resolver`).send({ resultado: "validado", motivo: "Confirmado por guardia", sancion: -20, bloquear: true }).expect(200);
    expect(resuelto.body.incidente).toMatchObject({ estado: "validado", resueltoPor: datosRegistro("1").correo, sancion: -20, bloqueoVigente: true });
    await comoAdmin("post", `${ruta}/resolver`).send({ resultado: "validado", motivo: "Otra vez", sancion: -20 }).expect(409);
    const puntos = await ranking(token);
    expect(puntos.puntaje).toBe(80);
    expect(puntos.ajustes).toEqual([expect.objectContaining({ tipo: "incidente", variacion: -20 })]);

    // La plaza queda bloqueada para nuevas asignaciones y el bloqueo no se levanta a mano.
    const ocupacion = await comoAdmin("get", "/admin/ocupacion").expect(200);
    expect(ocupacion.body.plazas.find((p) => p.codigo === "A1").estado).toBe("bloqueada");
    const otra = await reservar("13:00", "14:00");
    expect(otra.reserva.plaza.codigo).toBe("A2");
    const bloqueo = await db.bloqueoPlaza.findFirstOrThrow({ where: { incidenteId: body.incidente.id } });
    await comoAdmin("post", `/admin/bloqueos/${bloqueo.id}/levantar`).expect(409);

    const cerrado = await comoAdmin("post", `${ruta}/cerrar`).send({ motivo: "Se retiró el vehículo" }).expect(200);
    expect(cerrado.body.incidente).toMatchObject({ estado: "cerrado", bloqueoVigente: false });
    expect((await reservar("15:00", "16:00")).reserva.plaza.codigo).toBe("A1");
    expect((await ranking(token)).ajustes).toHaveLength(1);
  });

  test("una persona solo reporta incidentes de sus reservas", async () => {
    const propia = await reservar();
    const ajena = await reservar();
    await conToken(propia.token, "post", "/incidentes").send({ reservaId: ajena.reserva.id, descripcion: "No es mía" }).expect(404);
  });
});
