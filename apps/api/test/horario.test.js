import { readFile } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
const clock = createClock("2026-11-16T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
let ed113sj;
let ed113;
let token;
let siguiente = 200;
const ics = () => readFile(new URL("./fixtures/horario.ics", import.meta.url), "utf8");

const conToken = (metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);
const bloque = (cambios = {}) => ({ diaSemana: 1, inicio: "08:30", fin: "09:50", destinoId: ed113sj, titulo: "Cálculo I", ...cambios });

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  await sembrarPlazasDemo(db);
  ({ id: ed113sj } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  ({ id: ed113 } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113" } }));
}, 30_000);

beforeEach(async () => {
  token = await registrarEIniciar(app, datosRegistro(String(siguiente++)));
});

afterAll(() => db.$disconnect());

describe("horario semanal", () => {
  test("los bloques persisten y se pueden editar y eliminar", async () => {
    const creado = await conToken("post", "/horario/bloques").send(bloque()).expect(201);
    await conToken("post", "/horario/bloques").send(bloque({ diaSemana: 3, inicio: "10:00", fin: "11:20", destinoId: ed113 })).expect(201);
    // Una sesión nueva (como al reabrir la app) ve el mismo horario.
    const listado = await conToken("get", "/horario").expect(200);
    expect(listado.body.bloques.map((b) => `${b.diaSemana} ${b.inicio}-${b.fin} ${b.destino.idOrigen}`)).toEqual([
      "1 08:30-09:50 ED113-SJ",
      "3 10:00-11:20 ED113",
    ]);
    const editado = await conToken("patch", `/horario/bloques/${creado.body.bloque.id}`).send({ fin: "10:00" }).expect(200);
    expect(editado.body.bloque).toMatchObject({ inicio: "08:30", fin: "10:00", titulo: "Cálculo I" });
    await conToken("delete", `/horario/bloques/${creado.body.bloque.id}`).expect(204);
    expect((await conToken("get", "/horario").expect(200)).body.bloques).toHaveLength(1);
  });

  test("bloques inválidos se informan sin perder el horario anterior", async () => {
    await conToken("put", "/horario").send({ bloques: [bloque()] }).expect(200);
    const invalido = await conToken("put", "/horario")
      .send({
        bloques: [
          bloque({ inicio: "11:00", fin: "10:00" }),
          bloque({ diaSemana: 2, destinoId: 999999 }),
          bloque({ diaSemana: 4, inicio: "09:00", fin: "10:00" }),
          bloque({ diaSemana: 4, inicio: "09:30", fin: "11:00" }),
        ],
      })
      .expect(400);
    expect(Object.keys(invalido.body.error.details).sort()).toEqual(["bloques.0.fin"]);
    const segundo = await conToken("put", "/horario")
      .send({ bloques: [bloque({ diaSemana: 2, destinoId: 999999 }), bloque({ diaSemana: 4, inicio: "09:00", fin: "10:00" }), bloque({ diaSemana: 4, inicio: "09:30", fin: "11:00" })] })
      .expect(400);
    expect(Object.keys(segundo.body.error.details).sort()).toEqual(["bloques.0.destinoId", "bloques.1.inicio", "bloques.2.inicio"]);
    expect(segundo.body.error.message).toMatch(/horario anterior no cambió/);
    const actual = await conToken("get", "/horario").expect(200);
    expect(actual.body.bloques).toHaveLength(1);
    expect(actual.body.bloques[0]).toMatchObject({ diaSemana: 1, inicio: "08:30" });
  });

  test("un bloque que se superpone se rechaza también al crearlo o editarlo", async () => {
    await conToken("post", "/horario/bloques").send(bloque()).expect(201);
    const otro = await conToken("post", "/horario/bloques").send(bloque({ inicio: "09:50", fin: "11:00" })).expect(201);
    const solapa = await conToken("post", "/horario/bloques").send(bloque({ inicio: "09:00", fin: "10:00" })).expect(400);
    expect(solapa.body.error.details.inicio).toMatch(/lunes/);
    await conToken("patch", `/horario/bloques/${otro.body.bloque.id}`).send({ inicio: "09:00" }).expect(400);
    // La base también lo impide.
    const cuenta = await db.bloqueClase.findFirstOrThrow({ where: { id: otro.body.bloque.id } });
    await expect(
      db.bloqueClase.create({ data: { cuentaId: cuenta.cuentaId, destinoId: ed113, diaSemana: 1, inicioMinuto: 500, finMinuto: 600 } }),
    ).rejects.toThrow();
  });

  test("cada persona solo ve y edita su propio horario", async () => {
    const propio = await conToken("post", "/horario/bloques").send(bloque()).expect(201);
    const ajeno = await registrarEIniciar(app, datosRegistro(String(siguiente++)));
    expect((await request(app).get("/horario").set("Authorization", `Bearer ${ajeno}`).expect(200)).body.bloques).toEqual([]);
    await request(app).patch(`/horario/bloques/${propio.body.bloque.id}`).set("Authorization", `Bearer ${ajeno}`).send({ fin: "12:00" }).expect(404);
    await request(app).get("/horario").expect(401);
  });

  test("editar el horario conserva la reserva confirmada", async () => {
    await conToken("put", "/horario").send({ bloques: [bloque()] }).expect(200);
    const reserva = await conToken("post", "/reservas")
      .set("Idempotency-Key", `clave-horario-${siguiente}`)
      .send({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId: ed113sj })
      .expect(201);
    await conToken("put", "/horario").send({ bloques: [bloque({ destinoId: ed113, inicio: "14:00", fin: "16:00" })] }).expect(200);
    const vigente = await conToken("get", `/reservas/${reserva.body.reserva.id}`).expect(200);
    expect(vigente.body.reserva).toMatchObject({ estado: "confirmada", llegada: "09:00", destino: { idOrigen: "ED113-SJ" } });
  });
});

describe("importación .ics", () => {
  test("la vista previa propone bloques, marca los que requieren corrección y no guarda nada", async () => {
    const response = await conToken("post", "/horario/importar").send({ contenido: await ics() }).expect(200);
    const resumen = response.body.bloques.map((b) => [b.diaSemana, b.inicio, b.fin, b.ubicacion, b.coincidencias.length, b.destino?.idOrigen ?? null]);
    expect(resumen).toEqual([
      [1, "08:30", "09:50", "ED113", 2, null],
      [2, "10:00", "11:20", "Sala B12 - San Joaquín", expect.any(Number), expect.anything()],
      [3, "08:30", "09:50", "ED113", 2, null],
      [5, "14:00", "15:30", "Laboratorio que no existe", 0, null],
    ]);
    const ed = response.body.bloques[0];
    expect(ed.coincidencias.map((d) => d.idOrigen)).toEqual(["ED113", "ED113-SJ"]);
    expect(ed.problemas[0]).toMatch(/coincide con 2 destinos/);
    expect(response.body.bloques[3].problemas[0]).toMatch(/no está en el catálogo/);
    expect(response.body.omitidos).toEqual(["Feriado: no tiene hora de inicio y término."]);
    expect((await conToken("get", "/horario").expect(200)).body.bloques).toEqual([]);
  });

  test("tras elegir los destinos, confirmar guarda los bloques revisados", async () => {
    const { body } = await conToken("post", "/horario/importar").send({ contenido: await ics() }).expect(200);
    const revisados = body.bloques.map((b) => ({
      diaSemana: b.diaSemana,
      inicio: b.inicio,
      fin: b.fin,
      titulo: b.titulo,
      destinoId: b.destino?.id ?? ed113sj,
    }));
    const guardado = await conToken("put", "/horario").send({ bloques: revisados }).expect(200);
    expect(guardado.body.bloques).toHaveLength(4);
    expect(guardado.body.bloques[0]).toMatchObject({ titulo: "Cálculo I", destino: { idOrigen: "ED113-SJ" } });
  });

  test("un archivo ilegible se informa sin perder el horario", async () => {
    await conToken("put", "/horario").send({ bloques: [bloque()] }).expect(200);
    for (const contenido of ["esto no es un calendario", "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"]) {
      const response = await conToken("post", "/horario/importar").send({ contenido }).expect(400);
      expect(response.body.error.code).toBe("archivo_ilegible");
    }
    expect((await conToken("get", "/horario").expect(200)).body.bloques).toHaveLength(1);
  });
});
