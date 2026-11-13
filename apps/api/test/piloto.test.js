import request from "supertest";
import { createApp } from "../dist/app.js";
import { importarCursosUC, leerCursosUC } from "../dist/modules/catalogo/cursos-uc.js";
import { sembrarPlazasDemo, sembrarZonaPiloto } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { cerrarPiloto } from "../dist/modules/piloto/cierre.js";
import { calcularIndicadores } from "../dist/modules/piloto/indicadores.js";
import { simularPiloto } from "../dist/modules/piloto/simulacion.js";
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
let siguiente = 2400;
let clave = 1;

const local = (hhmm) => clock.set(`2026-11-16T${String(Number(hhmm.slice(0, 2)) + 3).padStart(2, "0")}:${hhmm.slice(3)}:00.000Z`);
const conToken = (token, metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);
const qrDe = (codigo) => qrs.find((q) => q.codigo === codigo).qr;
const indicador = (reporte, clave) => reporte.indicadores.find((i) => i.clave === clave);

async function cuenta() {
  const datos = datosRegistro(String(siguiente++));
  const token = await registrarEIniciar(app, datos);
  return { token, id: (await db.cuenta.findUniqueOrThrow({ where: { correo: datos.correo } })).id };
}

async function limpiar() {
  for (const tabla of ["lecturaQR", "encuestaSatisfaccion", "aviso", "ajusteRanking", "eventoReserva", "incidente", "solicitudEspera", "reserva", "bloqueClase", "medicionDisponibilidad", "resultadoPiloto"]) {
    await db[tabla].deleteMany();
  }
  await db.vehiculo.deleteMany({ where: { cuenta: { simulada: true } } });
  await db.sesion.deleteMany({ where: { cuenta: { simulada: true } } });
  await db.cuenta.deleteMany({ where: { simulada: true } });
}

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  qrs = [...(await sembrarPlazasDemo(db)), ...(await sembrarZonaPiloto(db))];
  await importarCursosUC(db, await leerCursosUC(directorioCatalogo));
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  admin = await registrarEIniciar(app, datosRegistro("1"));
  await db.cuenta.update({ where: { correo: datosRegistro("1").correo }, data: { rol: "admin" } });
}, 60_000);

beforeEach(async () => {
  await limpiar();
  clock.set("2026-11-16T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

/** Dos personas: una con clase (destino desde el horario) y otra con destino declarado. */
async function escenarioReal() {
  const conClase = await cuenta();
  const sala = await db.destino.findFirstOrThrow({ where: { nombre: "B25", tipo: "sala" } });
  await conToken(conClase.token, "post", "/horario/bloques").send({ diaSemana: 1, inicio: "09:00", fin: "11:00", destinoId: sala.id }).expect(201);
  const r1 = (await conToken(conClase.token, "post", "/reservas").set("Idempotency-Key", `piloto-${clave++}`)
    .send({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId: null }).expect(201)).body.reserva;
  const declarada = await cuenta();
  const r2 = (await conToken(declarada.token, "post", "/reservas").set("Idempotency-Key", `piloto-${clave++}`)
    .send({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId }).expect(201)).body.reserva;

  local("09:00");
  // La primera persona apunta primero al QR de otra plaza: es una lectura fallida.
  await conToken(conClase.token, "post", `/reservas/${r1.id}/entrada`).send({ qr: qrDe(r2.plaza.codigo), ...EN_CAMPUS }).expect(409);
  await conToken(conClase.token, "post", `/reservas/${r1.id}/entrada`).send({ qr: qrDe(r1.plaza.codigo), ...EN_CAMPUS }).expect(201);
  await conToken(declarada.token, "post", `/reservas/${r2.id}/entrada`).send({ qr: qrDe(r2.plaza.codigo), ...EN_CAMPUS }).expect(201);
  local("11:50");
  await conToken(conClase.token, "post", `/reservas/${r1.id}/salida`).send({ qr: qrDe(r1.plaza.codigo) }).expect(201);
  await conToken(declarada.token, "post", `/reservas/${r2.id}/salida`).send({ qr: qrDe(r2.plaza.codigo) }).expect(201);
  await conToken(conClase.token, "post", "/encuestas").send({ reservaId: r1.id, puntaje: 5 }).expect(201);
  await conToken(declarada.token, "post", "/encuestas").send({ reservaId: r2.id, puntaje: 3, comentario: "Lejos de mi sala" }).expect(201);
  const plaza = await db.plaza.findUniqueOrThrow({ where: { id: r2.plaza.id } });
  const inc = (await conToken(admin, "post", "/admin/incidentes").send({ plazaId: plaza.id, reservaId: r2.id, descripcion: "Plaza asignada ocupada" }).expect(201)).body.incidente;
  await conToken(admin, "post", `/admin/incidentes/${inc.id}/resolver`).send({ resultado: "validado", motivo: "Confirmado en terreno" }).expect(200);
  await conToken(admin, "post", "/admin/indicadores/mediciones").send({ desde: "2026-11-16", hasta: "2026-11-16", porcentaje: 99.5, fuente: "UptimeRobot" }).expect(201);
  return { conClase, declarada, r1, r2 };
}

describe("indicadores", () => {
  test("cada indicador trae numerador, denominador y meta", async () => {
    await escenarioReal();
    const { body } = await conToken(admin, "get", "/admin/indicadores?desde=2026-11-16&hasta=2026-11-16&modo=real").expect(200);
    expect(body).toMatchObject({ modo: "real", acredita: false });
    const valores = Object.fromEntries(body.indicadores.map((i) => [i.clave, [i.valor, i.numerador, i.denominador, i.cumple]]));
    expect(valores).toEqual({
      participantes: [2, 2, 2, false],
      asignaciones_con_horario: [50, 1, 2, false],
      satisfaccion: [50, 1, 2, false],
      disponibilidad: [99.5, null, 1, true],
      errores_asignacion: [50, 1, 2, false],
      dobles_reservas: [0, 0, 2, true],
      qr_primer_intento: [50, 1, 2, false],
    });
    expect(indicador(body, "qr_primer_intento").separado).toBe(true);
  });

  test("detecta dobles reservas por uso superpuesto en la misma plaza", async () => {
    const a = await cuenta();
    const b = await cuenta();
    const plaza = await db.plaza.findFirstOrThrow({ where: { codigo: "A1" } });
    const qr = await db.qrPlaza.findFirstOrThrow({ where: { plazaId: plaza.id, revocadoEn: null } });
    const base = { plazaId: plaza.id, destinoId, metros: 240, metodoDistancia: "peatonal", estado: "finalizada" };
    for (const [c, ini, fin, entrada, salida] of [
      [a, "12:00", "15:00", "12:00", "14:00"],
      [b, "13:00", "15:00", "13:30", "14:30"],
    ]) {
      const vehiculo = await db.vehiculo.findFirstOrThrow({ where: { cuentaId: c.id } });
      const t = (h) => new Date(`2026-11-16T${String(Number(h.slice(0, 2)) + 3).padStart(2, "0")}:${h.slice(3)}:00Z`);
      const r = await db.reserva.create({ data: { ...base, cuentaId: c.id, vehiculoId: vehiculo.id, inicio: t(ini), fin: t(fin), claveIdempotencia: `doble-${clave++}` } });
      await db.eventoReserva.createMany({ data: [{ reservaId: r.id, tipo: "entrada", qrPlazaId: qr.id, registradoEn: t(entrada) }, { reservaId: r.id, tipo: "salida", qrPlazaId: qr.id, registradoEn: t(salida) }] });
    }
    const reporte = await calcularIndicadores(db, "2026-11-16", "2026-11-16", "real");
    expect(indicador(reporte, "dobles_reservas")).toMatchObject({ valor: 1, cumple: false });
  });

  test("una simulación se reporta aparte y no acredita las metas", async () => {
    await escenarioReal();
    const resumen = await simularPiloto(db, {
      desde: "2026-11-16",
      dias: 2,
      usuarios: 16,
      semilla: 7,
      dominio: "demo.uc.cl",
      reservas: testConfig.reservas,
      ranking: testConfig.ranking,
    });
    expect(resumen.reservas).toBeGreaterThan(5);
    const simulacion = await calcularIndicadores(db, "2026-11-16", "2026-11-17", "simulacion");
    expect(simulacion).toMatchObject({ modo: "simulacion", acredita: false });
    expect(simulacion.nota).toMatch(/no acredita/);
    expect(indicador(simulacion, "participantes").denominador).toBe(16);
    expect(indicador(simulacion, "asignaciones_con_horario").denominador).toBe(resumen.reservas);
    expect(indicador(simulacion, "dobles_reservas").valor).toBe(0);
    // La medición real no cambia con la simulación.
    const real = await calcularIndicadores(db, "2026-11-16", "2026-11-17", "real");
    expect(indicador(real, "participantes").valor).toBe(2);
    expect(indicador(real, "disponibilidad").valor).toBe(99.5);
  }, 60_000);

  test("guarda el resultado del período y rechaza cuentas comunes", async () => {
    const { conClase } = await escenarioReal();
    await conToken(conClase.token, "get", "/admin/indicadores").expect(403);
    await conToken(conClase.token, "post", "/admin/indicadores/resultados").send({ desde: "2026-11-16", hasta: "2026-11-16" }).expect(403);
    await conToken(admin, "post", "/admin/indicadores/resultados").send({ desde: "2026-11-16", hasta: "2026-11-16", modo: "real" }).expect(201);
    const { body } = await conToken(admin, "get", "/admin/indicadores/resultados").expect(200);
    expect(body.resultados[0]).toMatchObject({ desde: "2026-11-16", hasta: "2026-11-16", modo: "real" });
  });
});

describe("encuesta", () => {
  test("se responde una vez, después de la salida y solo por reservas propias", async () => {
    const a = await cuenta();
    const otra = await cuenta();
    const reserva = (await conToken(a.token, "post", "/reservas").set("Idempotency-Key", `piloto-${clave++}`)
      .send({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId }).expect(201)).body.reserva;
    await conToken(a.token, "post", "/encuestas").send({ reservaId: reserva.id, puntaje: 4 }).expect(409);
    local("09:00");
    await conToken(a.token, "post", `/reservas/${reserva.id}/entrada`).send({ qr: qrDe(reserva.plaza.codigo), ...EN_CAMPUS }).expect(201);
    await conToken(a.token, "post", `/reservas/${reserva.id}/salida`).send({ qr: qrDe(reserva.plaza.codigo) }).expect(201);
    await conToken(a.token, "post", "/encuestas").send({ reservaId: reserva.id, puntaje: 6 }).expect(400);
    await conToken(otra.token, "post", "/encuestas").send({ reservaId: reserva.id, puntaje: 5 }).expect(404);
    await conToken(a.token, "post", "/encuestas").send({ reservaId: reserva.id, puntaje: 4 }).expect(201);
    await conToken(a.token, "post", "/encuestas").send({ reservaId: reserva.id, puntaje: 1 }).expect(200);
    expect((await db.encuestaSatisfaccion.findUniqueOrThrow({ where: { reservaId: reserva.id } })).puntaje).toBe(4);
  });
});

describe("cierre del piloto con datos ficticios", () => {
  test("conserva solo resultados anónimos y elimina los datos identificables", async () => {
    await escenarioReal();
    await simularPiloto(db, { desde: "2026-11-16", dias: 1, usuarios: 6, semilla: 3, dominio: "demo.uc.cl", reservas: testConfig.reservas, ranking: testConfig.ranking });
    const { resultados, eliminados } = await cerrarPiloto(db, clock());
    expect(resultados.map((r) => r.modo)).toEqual(["real", "simulacion"]);
    expect(eliminados.cuentas).toBeGreaterThanOrEqual(8);

    expect(await db.cuenta.count({ where: { rol: "usuario" } })).toBe(0);
    for (const tabla of ["vehiculo", "reserva", "eventoReserva", "aviso", "encuestaSatisfaccion", "lecturaQR", "incidente", "bloqueClase", "sesion"]) {
      const where = tabla === "sesion" ? { cuenta: { rol: "usuario" } } : {};
      expect([tabla, await db[tabla].count({ where })]).toEqual([tabla, 0]);
    }
    expect(await db.cuenta.count({ where: { rol: "admin" } })).toBe(1);
    expect(await db.plaza.count()).toBeGreaterThan(0);

    const guardados = await db.resultadoPiloto.findMany();
    const texto = JSON.stringify(guardados);
    expect(texto).not.toMatch(/@demo\.uc\.cl|SM\d{4}|AB\d{4}|Lejos de mi sala/);
    expect(guardados.find((r) => r.modo === "real").indicadores.find((i) => i.clave === "participantes").valor).toBe(2);
  }, 60_000);
});
