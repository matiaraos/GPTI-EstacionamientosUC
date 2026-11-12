import request from "supertest";
import { createApp } from "../dist/app.js";
import { bloquesDeActividad, importarCursosUC, leerCursosUC, leerModulos } from "../dist/modules/catalogo/cursos-uc.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
// Viernes 13 de noviembre de 2026, 07:00 en Santiago.
const clock = createClock("2026-11-13T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
let fuente;
let token;
let siguiente = 1500;

const conToken = (metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);
const vistaPrevia = async () => (await conToken("post", "/horario/uc/vista-previa").expect(200)).body;
/** Guarda los bloques que la vista previa propone incluir. */
const sincronizar = (vista) =>
  conToken("put", "/horario/uc").send({
    bloques: vista.bloques.filter((b) => b.incluir).map(({ actividadUCId, diaSemana, inicio, fin, destino }) => ({ actividadUCId, diaSemana, inicio, fin, destinoId: destino.id })),
  });

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  await sembrarPlazasDemo(db);
  fuente = await leerCursosUC(directorioCatalogo);
  await importarCursosUC(db, fuente);
}, 60_000);

beforeEach(async () => {
  token = await registrarEIniciar(app, datosRegistro(String(siguiente++)));
  clock.set("2026-11-13T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

describe("formato de Buscacursos", () => {
  test("lee días y módulos y une módulos consecutivos", () => {
    expect(leerModulos("L-W-V:4")).toEqual({ dias: [1, 3, 5], numeros: [4] });
    expect(bloquesDeActividad(leerModulos("L-W-V:4"))).toEqual([
      { diaSemana: 1, modulos: [4], inicio: "12:20", fin: "13:30" },
      { diaSemana: 3, modulos: [4], inicio: "12:20", fin: "13:30" },
      { diaSemana: 5, modulos: [4], inicio: "12:20", fin: "13:30" },
    ]);
    expect(bloquesDeActividad(leerModulos("M:5,6"))).toEqual([{ diaSemana: 2, modulos: [5, 6], inicio: "14:50", fin: "17:20" }]);
    expect(bloquesDeActividad(leerModulos("J:2,4"))).toHaveLength(2);
    expect(() => leerModulos("X:1")).toThrow(/formato/);
    expect(() => leerModulos("L:12")).toThrow();
  });

  test("la carga es idempotente y asocia las salas del catálogo", async () => {
    const antes = await db.actividadUC.findMany({ orderBy: { id: "asc" }, select: { id: true } });
    const resumen = await importarCursosUC(db, fuente);
    const despues = await db.actividadUC.findMany({ orderBy: { id: "asc" }, select: { id: true } });
    expect(despues).toEqual(antes);
    expect(await db.cursoUC.count()).toBe(resumen.secciones);
    expect(await db.perfilUC.count()).toBe(3);
    const conSala = await db.actividadUC.findFirstOrThrow({ where: { sala: "AE002" }, include: { destino: true } });
    expect(conSala.destino.idOrigen).toBe("AE002-SJ");
    expect((await db.actividadUC.findFirstOrThrow({ where: { sala: "CS-101" } })).destinoId).toBeNull();
    const enlazadas = await db.actividadUC.count({ where: { destinoId: { not: null } } });
    const conSalaTotal = await db.actividadUC.count({ where: { sala: { not: null } } });
    expect(enlazadas / conSalaTotal).toBeGreaterThan(0.9);
  });

  test("busca secciones por sigla como Buscacursos", async () => {
    const response = await conToken("get", "/cursos-uc?q=mat1610").expect(200);
    expect(response.body.secciones.length).toBeGreaterThan(5);
    expect(response.body.secciones[0]).toMatchObject({ sigla: "MAT1610", seccion: 1, nombre: "Cálculo I" });
    expect(response.body.secciones[0].actividades[0]).toMatchObject({ tipo: "CLAS", tipoNombre: "Cátedra", modulos: "L-W-V:4", horas: "12:20–13:30" });
    expect(response.body.modulos).toHaveLength(9);
  });
});

describe("conexión simulada y sincronización", () => {
  test("conecta un estudiante de prueba y propone su horario para revisar", async () => {
    const inicial = await conToken("get", "/horario/uc").expect(200);
    expect(inicial.body.conexion).toBeNull();
    expect(inicial.body.perfiles.map((p) => p.codigo)).toEqual(["ing-1", "ing-2", "ing-3"]);

    const { body } = await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-1" }).expect(200);
    expect(body.conexion.inscripcion.map((c) => c.sigla)).toEqual(["IIC1103", "MAT1203", "MAT1610", "QIM100E"]);
    expect(body.conexion.sincronizadaEn).toBeNull();

    const vista = await vistaPrevia();
    const calculo = vista.bloques.filter((b) => b.sigla === "MAT1610");
    expect(calculo.filter((b) => b.tipo === "CLAS").map((b) => [b.modulosTexto, b.inicio, b.fin, b.destino?.idOrigen])).toEqual([
      ["L:4", "12:20", "13:30", "C003-SJ"],
      ["W:4", "12:20", "13:30", "C003-SJ"],
      ["V:4", "12:20", "13:30", "C003-SJ"],
    ]);
    const laboratorio = calculo.find((b) => b.tipo === "LAB");
    expect(laboratorio).toMatchObject({ sala: null, destino: null, incluir: false });
    expect(laboratorio.problemas[0]).toMatch(/Sin sala/);
    const iic = vista.bloques.find((b) => b.sigla === "IIC1103" && b.tipo === "LAB");
    expect(iic).toMatchObject({ modulosTexto: "M:5,6", inicio: "14:50", fin: "17:20" });
    expect(vista.bloques.every((b) => b.cambio === "nuevo")).toBe(true);
    expect(await db.bloqueClase.count({ where: { cuenta: { conexionUC: { isNot: null } }, origen: "uc" } })).toBe(0);
  });

  test("sincronizar guarda los bloques UC y conserva los propios", async () => {
    await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-1" }).expect(200);
    const ed = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } });
    await conToken("post", "/horario/bloques").send({ diaSemana: 6, inicio: "09:00", fin: "11:00", destinoId: ed.id, titulo: "Taller propio" }).expect(201);

    const vista = await vistaPrevia();
    const guardado = await sincronizar(vista).expect(200);
    expect(guardado.body.conexion.sincronizadaEn).toBe("2026-11-13T10:00:00.000Z");
    const horario = (await conToken("get", "/horario").expect(200)).body.bloques;
    const uc = horario.filter((b) => b.origen === "uc");
    expect(uc).toHaveLength(vista.bloques.filter((b) => b.incluir).length);
    expect(uc.find((b) => b.curso?.sigla === "MAT1610")).toMatchObject({ titulo: "MAT1610-1 Cálculo I · Cátedra", curso: { tipo: "CLAS", modulos: "L-W-V:4" } });
    expect(horario.find((b) => b.titulo === "Taller propio")).toMatchObject({ origen: "manual" });

    // Reemplazar los bloques propios (por ejemplo, al importar un .ics) no toca los del horario UC.
    await conToken("put", "/horario").send({ bloques: [] }).expect(200);
    expect((await conToken("get", "/horario").expect(200)).body.bloques).toHaveLength(uc.length);

    // Sin cambios en la inscripción, la vista previa no muestra diferencias.
    const otra = await vistaPrevia();
    expect(otra.bloques.filter((b) => b.incluir).every((b) => b.cambio === "sin_cambios")).toBe(true);
    expect(otra.eliminados).toEqual([]);
  });

  test("un bloque sin sala se incluye eligiendo el destino y se conserva al volver a sincronizar", async () => {
    await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-1" }).expect(200);
    const vista = await vistaPrevia();
    const lab = vista.bloques.find((b) => b.sigla === "MAT1610" && b.tipo === "LAB");
    const sala = await db.destino.findFirstOrThrow({ where: { nombre: "B25", tipo: "sala" } });
    lab.incluir = true;
    lab.destino = { id: sala.id };
    await sincronizar(vista).expect(200);
    const nueva = await vistaPrevia();
    expect(nueva.bloques.find((b) => b.clave === lab.clave)).toMatchObject({ incluir: true, cambio: "sin_cambios", destino: { id: sala.id } });
  });

  test("la modificación de horario cambia de sección y la vista previa muestra las diferencias", async () => {
    const { body } = await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-1" }).expect(200);
    await sincronizar(await vistaPrevia()).expect(200);
    const calculo = body.conexion.inscripcion.find((c) => c.sigla === "MAT1610");
    const secciones = (await conToken("get", "/cursos-uc?q=MAT1610").expect(200)).body.secciones;
    const otra = secciones.find((s) => s.nrc !== calculo.nrc && !s.actividades.some((a) => a.modulos.includes(":4")));

    await conToken("patch", "/horario/uc/inscripcion").send({ accion: "cambiar", nrc: calculo.nrc, por: otra.nrc }).expect(200);
    const vista = await vistaPrevia();
    expect(vista.eliminados.length).toBeGreaterThan(0);
    expect(vista.eliminados.every((b) => b.titulo.startsWith("MAT1610-1 "))).toBe(true);
    expect(vista.bloques.filter((b) => b.sigla === "MAT1610").every((b) => b.cambio === "nuevo" && b.seccion === otra.seccion)).toBe(true);
    expect(vista.bloques.filter((b) => b.sigla !== "MAT1610" && b.incluir).every((b) => b.cambio === "sin_cambios")).toBe(true);
    await sincronizar(vista).expect(200);
    const horario = (await conToken("get", "/horario").expect(200)).body.bloques;
    expect(horario.filter((b) => b.curso?.sigla === "MAT1610").every((b) => b.curso.seccion === otra.seccion)).toBe(true);
  });

  test("valida agregar, quitar y cambiar sección", async () => {
    const { body } = await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-1" }).expect(200);
    const calculo = body.conexion.inscripcion.find((c) => c.sigla === "MAT1610");
    const fisica = (await conToken("get", "/cursos-uc?q=FIS1514").expect(200)).body.secciones[0];
    const otraCalculo = (await conToken("get", "/cursos-uc?q=MAT1610").expect(200)).body.secciones.find((s) => s.nrc !== calculo.nrc);

    const repetido = await conToken("patch", "/horario/uc/inscripcion").send({ accion: "agregar", nrc: otraCalculo.nrc }).expect(409);
    expect(repetido.body.error.message).toMatch(/Cambiar sección/);
    await conToken("patch", "/horario/uc/inscripcion").send({ accion: "cambiar", nrc: calculo.nrc, por: fisica.nrc }).expect(400);
    const agregado = await conToken("patch", "/horario/uc/inscripcion").send({ accion: "agregar", nrc: fisica.nrc }).expect(200);
    expect(agregado.body.conexion.inscripcion).toHaveLength(5);
    const quitado = await conToken("patch", "/horario/uc/inscripcion").send({ accion: "quitar", nrc: calculo.nrc }).expect(200);
    expect(quitado.body.conexion.inscripcion.map((c) => c.sigla)).not.toContain("MAT1610");
  });

  test("rechaza bloques que no son de la inscripción sin cambiar el horario", async () => {
    await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-1" }).expect(200);
    await sincronizar(await vistaPrevia()).expect(200);
    const antes = (await conToken("get", "/horario").expect(200)).body.bloques.length;
    const ajena = await db.actividadUC.findFirstOrThrow({ where: { curso: { sigla: "IIC2343" } } });
    const response = await conToken("put", "/horario/uc")
      .send({ bloques: [{ actividadUCId: ajena.id, diaSemana: 1, inicio: "08:20", fin: "09:30", destinoId: 1 }] })
      .expect(400);
    expect(response.body.error.details["bloques.0.actividadUCId"]).toBeDefined();
    expect((await conToken("get", "/horario").expect(200)).body.bloques).toHaveLength(antes);
  });

  test("las clases sincronizadas definen el destino de la reserva", async () => {
    await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-1" }).expect(200);
    await sincronizar(await vistaPrevia()).expect(200);
    // Lunes 16: MAT1610 cátedra en C003 (12:20–13:30) y ayudantía en B25 (14:50–16:00).
    const reserva = await conToken("post", "/reservas")
      .set("Idempotency-Key", `uc-reserva-${siguiente}`)
      .send({ fecha: "2026-11-16", llegada: "12:15", salida: "16:30", destinoId: null })
      .expect(201);
    expect(reserva.body.reserva).toMatchObject({ origenDestino: "horario", destino: { idOrigen: expect.stringMatching(/^C003/) } });
    const fila = await db.reserva.findUniqueOrThrow({ where: { id: reserva.body.reserva.id }, include: { destinoDesempate: true } });
    expect(fila.destinoDesempate.nombre).toBe("B25");
  });

  test("desconectar quita o conserva los bloques UC", async () => {
    await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-2" }).expect(200);
    await sincronizar(await vistaPrevia()).expect(200);
    const total = (await conToken("get", "/horario").expect(200)).body.bloques.length;
    await conToken("delete", "/horario/uc?bloques=conservar").expect(204);
    const conservados = (await conToken("get", "/horario").expect(200)).body.bloques;
    expect(conservados).toHaveLength(total);
    expect(conservados.every((b) => b.origen === "manual")).toBe(true);
    expect((await conToken("get", "/horario/uc").expect(200)).body.conexion).toBeNull();

    await conToken("post", "/horario/uc/conectar").send({ perfil: "ing-3" }).expect(200);
    await conToken("delete", "/horario/uc").expect(204);
    expect((await conToken("get", "/horario").expect(200)).body.bloques).toHaveLength(total);
  });
});
