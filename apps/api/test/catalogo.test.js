import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { resolverQr } from "../dist/modules/catalogo/qr.js";
import { createClock, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
const app = createApp({ config: testConfig, db, clock: createClock() });
let fuentes;
let token;

const snapshot = async () => ({
  zonas: await db.zona.findMany({ select: { id: true, idOrigen: true }, orderBy: { id: "asc" } }),
  destinos: await db.destino.count(),
  cercanias: await db.cercaniaBloque.count(),
  primerDestino: await db.destino.findUnique({ where: { idOrigen: "ED113-SJ" }, select: { id: true } }),
});

beforeAll(async () => {
  await resetDatabase(db);
  fuentes = await leerFuentesCatalogo(directorioCatalogo);
  await importarCatalogo(db, fuentes);
  token = await registrarEIniciar(app);
}, 30_000);

afterAll(() => db.$disconnect());

describe("importación del catálogo", () => {
  test("carga los 10 bloques, 404 salas, 25 edificios y una distancia por par", async () => {
    expect(await db.zona.count()).toBe(10);
    expect(await db.destino.count({ where: { tipo: "sala" } })).toBe(404);
    expect(await db.destino.count({ where: { tipo: "edificio" } })).toBe(25);
    expect(await db.cercaniaBloque.count()).toBe((404 + 25) * 10);
    expect(await db.campus.count()).toBe(1);
  });

  test("cargar el catálogo dos veces conserva los identificadores y evita duplicados", async () => {
    const antes = await snapshot();
    const resumen = await importarCatalogo(db, fuentes);
    expect(resumen).toMatchObject({ zonas: 10, destinos: 429 });
    expect(await snapshot()).toEqual(antes);
  }, 30_000);

  test("salas con el mismo nombre conservan IDs distintos", async () => {
    const ed113 = await db.destino.findMany({ where: { nombre: "ED113" }, orderBy: { idOrigen: "asc" } });
    expect(ed113.map((destino) => destino.idOrigen)).toEqual(["ED113", "ED113-SJ"]);
    expect(new Set(ed113.map((destino) => destino.id)).size).toBe(2);
  });

  test("los accesos vehiculares quedan fuera de los bloques", async () => {
    const idsAccesos = fuentes.features
      .filter((feature) => feature.properties.tipo === "acceso_vehicular")
      .map((feature) => feature.properties.id);
    expect(idsAccesos).toHaveLength(10);
    expect(await db.zona.count({ where: { idOrigen: { in: idsAccesos } } })).toBe(0);
  });

  test("conserva metros, método y calidad de las conexiones", async () => {
    const cercania = await db.cercaniaBloque.findFirstOrThrow({
      where: { destino: { idOrigen: "ED113-SJ" }, zona: { idOrigen: "PARKING-7" } },
    });
    expect(cercania).toMatchObject({ metros: 240, metodo: "peatonal", conexionBloque: "inferida", orden: 1 });
    expect(await db.cercaniaBloque.count({ where: { metodo: "linea_recta" } })).toBe(110 + 20);
  });

  test("los edificios tienen distancia a cada bloque con la misma red", async () => {
    const edificio = await db.destino.findFirstOrThrow({ where: { tipo: "edificio" }, include: { cercanias: true } });
    expect(edificio.cercanias).toHaveLength(10);
  });
});

describe("búsqueda de destinos", () => {
  const buscar = (q) => request(app).get("/destinos").query({ q }).set("Authorization", `Bearer ${token}`);

  test("busca por código y entrega ID, nombre y tipo; los homónimos aparecen por separado", async () => {
    const response = await buscar("ed113").expect(200);
    const exactos = response.body.destinos.filter((destino) => destino.nombre === "ED113");
    expect(exactos).toHaveLength(2);
    expect(response.body.destinos[0]).toMatchObject({ nombre: "ED113", tipo: "sala" });
    expect(response.body.destinos[0]).toEqual(
      expect.objectContaining({ id: expect.any(Number), idOrigen: expect.any(String), pisos: expect.any(Array) }),
    );
  });

  test("busca edificios por nombre sin distinguir mayúsculas", async () => {
    const response = await buscar("centro médico").expect(200);
    expect(response.body.destinos).toEqual([expect.objectContaining({ nombre: "Centro Médico San Joaquín", tipo: "edificio" })]);
  });

  test("trata los comodines como texto", async () => {
    const response = await buscar("%").expect(200);
    expect(response.body.destinos).toEqual([]);
  });

  test("consulta un destino por ID y responde 404 si no existe", async () => {
    const { id } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } });
    const ok = await request(app).get(`/destinos/${id}`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(ok.body.destino).toMatchObject({ id, idOrigen: "ED113-SJ", tipo: "sala" });
    const missing = await request(app).get("/destinos/999999").set("Authorization", `Bearer ${token}`).expect(404);
    expect(missing.body.error.code).toBe("destino_no_encontrado");
  });

  test("exige sesión", async () => {
    await request(app).get("/destinos").query({ q: "ED" }).expect(401);
  });
});

describe("plazas de prueba y QR", () => {
  let plazas;

  beforeAll(async () => {
    plazas = await sembrarPlazasDemo(db);
  });

  test("habilita dos bloques con plazas regulares, horarios y un QR vigente por plaza", async () => {
    expect(plazas.map((plaza) => `${plaza.bloque}/${plaza.codigo}`)).toEqual([
      "PARKING-7/A1",
      "PARKING-7/A2",
      "PARKING-5/B1",
      "PARKING-5/B2",
      "PARKING-5/B3",
    ]);
    expect(await db.plaza.count({ where: { tipo: "regular", activa: true } })).toBe(5);
    expect(await db.horarioZona.count()).toBe(12);
  });

  test("sembrar de nuevo no duplica plazas ni cambia los QR", async () => {
    expect(await sembrarPlazasDemo(db)).toEqual(plazas);
    expect(await db.qrPlaza.count()).toBe(5);
  });

  test("la API identifica la plaza correcta a partir de su QR", async () => {
    for (const esperada of plazas) {
      const resultado = await resolverQr(db, `  ${esperada.qr}\n`);
      expect(resultado.plaza.codigo).toBe(esperada.codigo);
      expect(resultado.zona.nombre).toBe(esperada.zona);
    }
  });

  test("rechaza QR ilegibles, desconocidos y revocados", async () => {
    await expect(resolverQr(db, "https://example.com")).rejects.toMatchObject({ status: 400, code: "qr_ilegible" });
    await expect(resolverQr(db, undefined)).rejects.toMatchObject({ code: "qr_ilegible" });
    await expect(resolverQr(db, "MEUC:noexisteNingunCodigo")).rejects.toMatchObject({ status: 404, code: "qr_desconocido" });

    const identificador = plazas[0].qr.slice("MEUC:".length);
    await db.qrPlaza.update({ where: { identificador }, data: { revocadoEn: new Date() } });
    await expect(resolverQr(db, plazas[0].qr)).rejects.toMatchObject({ status: 409, code: "qr_revocado" });
  });

  test("una plaza no puede tener dos QR vigentes", async () => {
    const plaza = await db.plaza.findFirstOrThrow({ where: { codigo: "B1" } });
    await expect(db.qrPlaza.create({ data: { plazaId: plaza.id, identificador: "otroIdentificadorVigente" } })).rejects.toThrow();
  });
});
