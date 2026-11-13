import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo, sembrarZonaPiloto } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { procesarVencimientos } from "../dist/modules/ranking/vencimientos.js";
import { procesarRenovaciones } from "../dist/modules/recurrencia/series.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
// Miércoles 18 de noviembre de 2026, 07:00 en Santiago. La semana siguiente empieza el lunes 23.
const clock = createClock("2026-11-18T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
let destinoId;
let zonaPiloto;
let siguiente = 2100;
let clave = 1;

const conToken = (token, metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);
const renovar = (opciones) => procesarRenovaciones(db, clock, { reservas: testConfig.reservas, ranking: testConfig.ranking }, opciones);

async function cuenta() {
  const datos = datosRegistro(String(siguiente++));
  const token = await registrarEIniciar(app, datos);
  const { id } = await db.cuenta.findUniqueOrThrow({ where: { correo: datos.correo } });
  return { token, id };
}

const bloque = (diaSemana, cambios = {}) => ({ diaSemana, llegada: "09:00", salida: "12:00", destinoId, ...cambios });
const crear = (token, bloques = [bloque(1), bloque(3)], k = `serie-semanal-${clave++}`) =>
  conToken(token, "post", "/series").set("Idempotency-Key", k).send({ bloques });
const ocurrenciasDe = (cuentaId) =>
  db.reserva.findMany({ where: { cuentaId, bloqueSerieId: { not: null } }, orderBy: { inicio: "asc" }, include: { plaza: { include: { zona: true } } } });
const fecha = (r) => r.fechaOcurrencia.toISOString().slice(0, 10);

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  await sembrarPlazasDemo(db);
  await sembrarZonaPiloto(db);
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  zonaPiloto = await db.zona.findUniqueOrThrow({ where: { idOrigen: "PARKING-2" } });
}, 30_000);

beforeEach(async () => {
  await db.aviso.deleteMany();
  await db.ajusteRanking.deleteMany();
  await db.solicitudEspera.deleteMany();
  await db.eventoReserva.deleteMany();
  await db.reserva.deleteMany();
  await db.bloqueSerie.deleteMany();
  await db.serieReserva.deleteMany();
  clock.set("2026-11-18T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

describe("creación y tope del 30 %", () => {
  test("registra la serie y sus ocurrencias de la semana en la zona piloto, sin duplicar en un reintento", async () => {
    const { token, id } = await cuenta();
    const k = `serie-semanal-${clave++}`;
    const creada = await crear(token, undefined, k).expect(201);
    await crear(token, undefined, k).expect(200);
    const ocurrencias = await ocurrenciasDe(id);
    expect(ocurrencias.map((r) => [fecha(r), r.plaza.zona.idOrigen, r.plaza.codigo, r.estado])).toEqual([
      ["2026-11-23", "PARKING-2", "I1", "confirmada"],
      ["2026-11-25", "PARKING-2", "I1", "confirmada"],
    ]);
    const lista = (await conToken(token, "get", "/series").expect(200)).body.series;
    expect(lista).toEqual([
      expect.objectContaining({ id: creada.body.serie.id, estado: "activa", semanaHasta: "2026-11-23", zona: expect.objectContaining({ id: zonaPiloto.id }) }),
    ]);
    expect(lista[0].ocurrencias.map((o) => o.fecha)).toEqual(["2026-11-23", "2026-11-25"]);
    expect(await db.aviso.count({ where: { cuentaId: id, titulo: "Reserva semanal confirmada" } })).toBe(2);
  });

  test("en una zona de diez plazas, una serie que excede tres plazas recurrentes se rechaza y la reserva diaria sigue disponible", async () => {
    for (let i = 0; i < 3; i++) await crear((await cuenta()).token).expect(201);
    const cuarta = await cuenta();
    const rechazo = await crear(cuarta.token).expect(409);
    expect(rechazo.body.error).toMatchObject({ code: "tope_recurrente" });
    expect(rechazo.body.error.message).toMatch(/3 de 3 plazas.*30 % de 10/);
    const elegibilidad = (await conToken(cuarta.token, "get", "/series/elegibilidad").expect(200)).body;
    expect(elegibilidad).toMatchObject({ elegible: false, zona: { plazas: 10, tope: 3, usadas: 3 } });
    await conToken(cuarta.token, "post", "/reservas").set("Idempotency-Key", `diaria-${clave++}`)
      .send({ fecha: "2026-11-23", llegada: "09:00", salida: "12:00", destinoId }).expect(201);
    expect(await db.serieReserva.count()).toBe(3);
  });

  test("creaciones simultáneas no superan el tope", async () => {
    const cuentas = await Promise.all(Array.from({ length: 6 }, () => cuenta()));
    const respuestas = await Promise.all(cuentas.map((c) => crear(c.token)));
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 201, 201, 409, 409, 409]);
    expect(await db.serieReserva.count({ where: { zonaId: zonaPiloto.id, estado: "activa" } })).toBe(3);
  });

  test("exige el puntaje mínimo y respeta el límite de bloques", async () => {
    const baja = await cuenta();
    await db.ajusteRanking.create({ data: { cuentaId: baja.id, tipo: "rectificacion", claveOrigen: `prueba-${clave++}`, variacion: -10, motivo: "prueba", registradoEn: clock() } });
    expect((await crear(baja.token).expect(403)).body.error.code).toBe("no_elegible");
    const muchos = await cuenta();
    const response = await crear(muchos.token, [1, 2, 3, 4, 5, 6].map((d) => bloque(d, { llegada: "09:00", salida: "10:00" }))).expect(400);
    expect(response.body.error.details.bloques).toMatch(/hasta 5/);
  });
});

describe("renovación semanal", () => {
  async function serieCumplida() {
    const c = await cuenta();
    await crear(c.token).expect(201);
    await db.reserva.updateMany({ where: { cuentaId: c.id }, data: { estado: "finalizada" } });
    return c;
  }

  test("una semana cumplida genera la siguiente sin duplicados aunque se reintente", async () => {
    const c = await serieCumplida();
    clock.set("2026-11-27T13:00:00.000Z"); // viernes: aún no es fin de semana
    expect((await renovar()).renovadas).toEqual([]);
    clock.set("2026-11-28T13:00:00.000Z"); // sábado 28
    const primera = await renovar();
    expect(primera.renovadas).toHaveLength(1);
    expect(await renovar()).toEqual({ renovadas: [], revocadas: [], omitidas: [] });
    await Promise.all([renovar(), renovar()]);
    expect((await ocurrenciasDe(c.id)).map(fecha)).toEqual(["2026-11-23", "2026-11-25", "2026-11-30", "2026-12-02"]);
  });

  test("una semana incumplida no se renueva y revoca la serie", async () => {
    const c = await cuenta();
    await crear(c.token).expect(201);
    const [lunes, miercoles] = await ocurrenciasDe(c.id);
    await db.reserva.update({ where: { id: lunes.id }, data: { estado: "finalizada" } });
    await db.reserva.update({ where: { id: miercoles.id }, data: { estado: "vencida" } });
    clock.set("2026-11-29T13:00:00.000Z"); // domingo 29
    expect((await renovar()).revocadas).toHaveLength(1);
    expect((await ocurrenciasDe(c.id)).map(fecha)).toEqual(["2026-11-23", "2026-11-25"]);
    expect((await db.serieReserva.findFirstOrThrow({ where: { cuentaId: c.id } })).estado).toBe("revocada");
  });
});

describe("cancelaciones y ausencia", () => {
  test("cancelar una fecha conserva la serie y su registro impide recrearla", async () => {
    const c = await cuenta();
    await crear(c.token).expect(201);
    const [lunes] = await ocurrenciasDe(c.id);
    await conToken(c.token, "post", `/reservas/${lunes.id}/cancelar`).expect(200);
    expect((await db.serieReserva.findFirstOrThrow({ where: { cuentaId: c.id } })).estado).toBe("activa");
    await db.reserva.updateMany({ where: { cuentaId: c.id, estado: "confirmada" }, data: { estado: "finalizada" } });
    clock.set("2026-11-28T13:00:00.000Z");
    await renovar();
    const ocurrencias = await ocurrenciasDe(c.id);
    expect(ocurrencias.map((r) => `${fecha(r)}:${r.estado}`)).toEqual([
      "2026-11-23:cancelada",
      "2026-11-25:finalizada",
      "2026-11-30:confirmada",
      "2026-12-02:confirmada",
    ]);
  });

  test("cancelar la serie libera las ocurrencias futuras y el cupo de la zona", async () => {
    const cuentas = [];
    for (let i = 0; i < 3; i++) {
      const c = await cuenta();
      const r = await crear(c.token).expect(201);
      cuentas.push({ ...c, serieId: r.body.serie.id });
    }
    const cancelada = await conToken(cuentas[0].token, "post", `/series/${cuentas[0].serieId}/cancelar`).expect(200);
    expect(cancelada.body.liberadas).toBe(2);
    expect((await ocurrenciasDe(cuentas[0].id)).map((r) => r.estado)).toEqual(["cancelada", "cancelada"]);
    await crear((await cuenta()).token).expect(201);
  });

  test("una ausencia revoca el beneficio, libera las próximas fechas y penaliza una vez", async () => {
    const c = await cuenta();
    await crear(c.token).expect(201);
    clock.set("2026-11-23T12:16:00.000Z"); // lunes 23, 09:16: terminó la ventana de llegada
    await procesarVencimientos(db, clock(), testConfig.reservas, testConfig.ranking);
    await procesarVencimientos(db, clock(), testConfig.reservas, testConfig.ranking);
    expect((await ocurrenciasDe(c.id)).map((r) => r.estado)).toEqual(["ausente", "cancelada"]);
    expect(await db.serieReserva.findFirstOrThrow({ where: { cuentaId: c.id } })).toMatchObject({ estado: "revocada" });
    const ajustes = await db.ajusteRanking.findMany({ where: { cuentaId: c.id }, orderBy: { id: "asc" } });
    expect(ajustes.map((a) => [a.tipo, a.variacion])).toEqual([
      ["ausencia", -10],
      ["revocacion_recurrente", -10],
    ]);
    expect(await db.aviso.count({ where: { cuentaId: c.id, titulo: "Reserva semanal revocada" } })).toBe(1);
    clock.set("2026-11-28T13:00:00.000Z");
    expect((await renovar()).renovadas).toEqual([]);
  });
});
