import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
// Lunes 16 de noviembre de 2026, 07:00 en Santiago.
const clock = createClock("2026-11-16T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
const VENTANA_MS = 400;
const appSimultanea = createApp({ config: { ...testConfig, reservas: { ...testConfig.reservas, simultaneidadMs: VENTANA_MS } }, db, clock });
let destinoId;
let ultimaId;
let zonas;
let siguiente = 900;
let clave = 1;

const visita = (cambios = {}) => ({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId, ...cambios });

async function nuevaCuenta(aplicacion = app) {
  const datos = datosRegistro(String(siguiente++));
  const token = await registrarEIniciar(aplicacion, datos);
  const { id } = await db.cuenta.findUniqueOrThrow({ where: { correo: datos.correo } });
  return { token, id };
}

const solicitar = (token, body = visita(), aplicacion = app) =>
  request(aplicacion).post("/reservas").set("Authorization", `Bearer ${token}`).set("Idempotency-Key", `asignacion-${clave++}`).send(body);
const conToken = (token, metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`);
const puntaje = (cuentaId, variacion) =>
  db.ajusteRanking.create({
    data: { cuentaId, tipo: "rectificacion", claveOrigen: `prueba:${cuentaId}:${clave++}`, variacion, motivo: "Puntaje de prueba", registradoEn: clock() },
  });

/** Ocupa todas las plazas en el intervalo con reservas de otras cuentas. */
async function llenar(cambios = {}) {
  const reservas = [];
  for (let i = 0; i < 5; i++) {
    const { token } = await nuevaCuenta();
    reservas.push({ token, reserva: (await solicitar(token, visita(cambios)).expect(201)).body.reserva });
  }
  return reservas;
}

async function fijarCercania(bloque, destino, valores) {
  const zonaId = zonas[bloque];
  if (valores === null) {
    await db.cercaniaBloque.deleteMany({ where: { zonaId, destinoId: destino } });
    return;
  }
  await db.cercaniaBloque.upsert({
    where: { zonaId_destinoId: { zonaId, destinoId: destino } },
    create: { zonaId, destinoId: destino, orden: 1, ...valores },
    update: valores,
  });
}

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  await sembrarPlazasDemo(db);
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  ({ id: ultimaId } = await db.destino.findFirstOrThrow({ where: { tipo: "sala", idOrigen: { not: { startsWith: "ED113" } } }, orderBy: { id: "asc" } }));
  zonas = Object.fromEntries((await db.zona.findMany({ where: { idOrigen: { in: ["PARKING-5", "PARKING-7"] } } })).map((z) => [z.idOrigen, z.id]));
}, 30_000);

beforeEach(async () => {
  await db.solicitudEspera.deleteMany();
  await db.ajusteRanking.deleteMany();
  await db.eventoReserva.deleteMany();
  await db.reserva.deleteMany();
  await db.bloqueClase.deleteMany();
  await db.autorizacionPreferente.deleteMany();
  await db.plaza.updateMany({ data: { tipo: "regular", activa: true } });
  clock.set("2026-11-16T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

describe("destino desde el horario y desempate por la última clase", () => {
  let cercaniasOriginales;
  beforeAll(async () => {
    cercaniasOriginales = await db.cercaniaBloque.findMany({ where: { destinoId: { in: [destinoId, ultimaId] } } });
  });
  afterEach(async () => {
    await db.cercaniaBloque.deleteMany({ where: { destinoId: { in: [destinoId, ultimaId] } } });
    await db.cercaniaBloque.createMany({ data: cercaniasOriginales });
  });

  async function cuentaConClases() {
    const cuenta = await nuevaCuenta();
    await conToken(cuenta.token, "put", "/horario")
      .send({
        bloques: [
          { diaSemana: 1, inicio: "09:00", fin: "10:00", destinoId, titulo: "Primera" },
          { diaSemana: 1, inicio: "10:30", fin: "11:30", destinoId: ultimaId, titulo: "Última" },
        ],
      })
      .expect(200);
    return cuenta;
  }

  test("con dos bloques empatados para la primera clase, gana el más cercano a la última", async () => {
    await fijarCercania("PARKING-7", destinoId, { metodo: "peatonal", metros: 200 });
    await fijarCercania("PARKING-5", destinoId, { metodo: "peatonal", metros: 200 });
    await fijarCercania("PARKING-7", ultimaId, { metodo: "peatonal", metros: 300 });
    await fijarCercania("PARKING-5", ultimaId, { metodo: "peatonal", metros: 100 });
    const { token } = await cuentaConClases();
    const response = await solicitar(token, visita({ destinoId: null })).expect(201);
    expect(response.body.reserva).toMatchObject({ plaza: { codigo: "B1" }, origenDestino: "horario", destino: { id: destinoId } });
    expect((await db.reserva.findUniqueOrThrow({ where: { id: response.body.reserva.id } })).destinoDesempateId).toBe(ultimaId);
  });

  test("el desempate aplica el orden de métodos y deja al final los bloques sin distancia a la última clase", async () => {
    await fijarCercania("PARKING-7", destinoId, { metodo: "peatonal", metros: 200 });
    await fijarCercania("PARKING-5", destinoId, { metodo: "peatonal", metros: 200 });
    await fijarCercania("PARKING-7", ultimaId, { metodo: "linea_recta", metros: 50 });
    await fijarCercania("PARKING-5", ultimaId, { metodo: "peatonal", metros: 500 });
    const primera = await cuentaConClases();
    expect((await solicitar(primera.token, visita({ destinoId: null })).expect(201)).body.reserva.plaza.codigo).toBe("B1");

    await db.reserva.deleteMany();
    await fijarCercania("PARKING-5", ultimaId, null);
    const segunda = await cuentaConClases();
    expect((await solicitar(segunda.token, visita({ destinoId: null })).expect(201)).body.reserva.plaza.codigo).toBe("A1");
  });

  test("el destino declarado se usa cuando no hay clases y es obligatorio en ese caso", async () => {
    const { token } = await nuevaCuenta();
    const sinDestino = await solicitar(token, visita({ destinoId: null })).expect(400);
    expect(sinDestino.body.error.details.destinoId).toMatch(/No tienes clases/);
    const declarada = await solicitar(token, visita()).expect(201);
    expect(declarada.body.reserva).toMatchObject({ origenDestino: "declarado", destino: { id: destinoId } });
    // Clases fuera del horario de la visita no cuentan.
    const conClases = await cuentaConClases();
    const tarde = await solicitar(conClases.token, visita({ llegada: "13:00", salida: "15:00" })).expect(201);
    expect(tarde.body.reserva.origenDestino).toBe("declarado");
  });
});

describe("solicitudes simultáneas", () => {
  async function dejarUnaPlaza() {
    const ocupadas = [];
    for (let i = 0; i < 4; i++) ocupadas.push(await solicitar((await nuevaCuenta()).token).expect(201));
    return ocupadas;
  }

  test("dentro de la ventana se atiende primero el mayor ranking aunque llegue después", async () => {
    await dejarUnaPlaza();
    const baja = await nuevaCuenta();
    const alta = await nuevaCuenta();
    await puntaje(baja.id, -10);
    const primera = solicitar(baja.token, visita(), appSimultanea);
    await new Promise((r) => setTimeout(r, 100));
    const segunda = solicitar(alta.token, visita(), appSimultanea);
    const [rBaja, rAlta] = await Promise.all([primera, segunda]);
    expect(rAlta.status).toBe(201);
    expect(rBaja.status).toBe(409);
    expect(rBaja.body.error.code).toBe("sin_cupo");
  });

  test("con igual ranking se atiende la solicitud más antigua", async () => {
    await dejarUnaPlaza();
    const antigua = await nuevaCuenta();
    const reciente = await nuevaCuenta();
    const primera = solicitar(antigua.token, visita(), appSimultanea);
    await new Promise((r) => setTimeout(r, 100));
    const segunda = solicitar(reciente.token, visita(), appSimultanea);
    const [rAntigua, rReciente] = await Promise.all([primera, segunda]);
    expect([rAntigua.status, rReciente.status]).toEqual([201, 409]);
  });
});

describe("plazas preferentes", () => {
  const habilitar = (cuentaId, vigenteHasta, revocadaEn = null) =>
    db.autorizacionPreferente.create({ data: { cuentaId, vigenteHasta, revocadaEn, otorgadaEn: clock(), otorgadaPorId: cuentaId } });

  test("una autorización vigente permite plazas preferentes y una vencida o revocada las excluye", async () => {
    await db.plaza.updateMany({ where: { codigo: "A1" }, data: { tipo: "preferente" } });
    const vigente = await nuevaCuenta();
    await habilitar(vigente.id, new Date("2026-12-31T03:00:00Z"));
    expect((await solicitar(vigente.token).expect(201)).body.reserva.plaza.codigo).toBe("A1");
    await db.reserva.deleteMany();

    const vencida = await nuevaCuenta();
    await habilitar(vencida.id, new Date("2026-11-16T09:00:00Z"));
    expect((await solicitar(vencida.token).expect(201)).body.reserva.plaza.codigo).toBe("A2");

    const venceAntes = await nuevaCuenta();
    // Vigente hoy, pero vencida al inicio de la visita del día siguiente.
    await habilitar(venceAntes.id, new Date("2026-11-17T03:00:00Z"));
    expect((await solicitar(venceAntes.token, visita({ fecha: "2026-11-17" })).expect(201)).body.reserva.plaza.codigo).toBe("A2");

    const revocada = await nuevaCuenta();
    await habilitar(revocada.id, new Date("2026-12-31T03:00:00Z"), new Date("2026-11-15T12:00:00Z"));
    expect((await solicitar(revocada.token).expect(201)).body.reserva.plaza.codigo).toBe("B1");
  });

  test("una cuenta habilitada también puede recibir una plaza regular", async () => {
    await db.plaza.updateMany({ where: { codigo: "B3" }, data: { tipo: "preferente" } });
    const cuenta = await nuevaCuenta();
    await habilitar(cuenta.id, new Date("2026-12-31T03:00:00Z"));
    expect((await solicitar(cuenta.token).expect(201)).body.reserva.plaza.codigo).toBe("A1");
  });
});

describe("cambio de reserva", () => {
  const cambiar = (token, id, body, k = `cambio-${clave++}`) =>
    conToken(token, "post", `/reservas/${id}/cambiar`).set("Idempotency-Key", k).send(body);

  test("una alternativa fallida conserva la reserva anterior", async () => {
    const { token } = await nuevaCuenta();
    const original = (await solicitar(token).expect(201)).body.reserva;
    await llenar({ llegada: "13:00", salida: "15:00" });
    const fallida = await cambiar(token, original.id, visita({ llegada: "13:00", salida: "15:00" })).expect(409);
    expect(fallida.body.error.code).toBe("sin_cupo");
    const actual = await conToken(token, "get", `/reservas/${original.id}`).expect(200);
    expect(actual.body.reserva).toMatchObject({ estado: "confirmada", llegada: "09:00", plaza: { codigo: original.plaza.codigo } });
    expect(await db.reserva.count({ where: { reemplazaId: original.id } })).toBe(0);
  });

  test("una alternativa aceptada reemplaza la original, también si se solapa con ella", async () => {
    const { token } = await nuevaCuenta();
    const original = (await solicitar(token).expect(201)).body.reserva;
    const k = `cambio-ok-${clave++}`;
    const nueva = await cambiar(token, original.id, visita({ llegada: "10:00", salida: "13:00" }), k).expect(201);
    expect(nueva.body.reserva).toMatchObject({ estado: "confirmada", llegada: "10:00", reemplazaId: original.id });
    expect((await conToken(token, "get", `/reservas/${original.id}`).expect(200)).body.reserva.estado).toBe("cancelada");
    // El reintento devuelve la misma reserva nueva.
    const repetida = await cambiar(token, original.id, visita({ llegada: "10:00", salida: "13:00" }), k).expect(200);
    expect(repetida.body.reserva.id).toBe(nueva.body.reserva.id);
    // Una reserva ya reemplazada no se vuelve a cambiar.
    await cambiar(token, original.id, visita({ llegada: "14:00", salida: "15:00" })).expect(409);
  });
});

describe("lista de espera", () => {
  const esperar = (token, body) => conToken(token, "post", "/esperas").set("Idempotency-Key", `espera-${clave++}`).send(body);

  test("sin cupo se ofrece la espera, que exige consentimiento", async () => {
    await llenar();
    const { token } = await nuevaCuenta();
    expect((await solicitar(token).expect(409)).body.error.message).toMatch(/lista de espera/);
    const sinConsentimiento = await esperar(token, visita()).expect(400);
    expect(sinConsentimiento.body.error.details.consentimiento).toBeDefined();
    const espera = await esperar(token, { ...visita(), consentimiento: true }).expect(201);
    expect(espera.body.espera).toMatchObject({ estado: "pendiente", llegada: "09:00", reservaId: null });
    await esperar(token, { ...visita({ llegada: "10:00" }), consentimiento: true }).expect(409);
  });

  test("una liberación atiende al siguiente candidato compatible por ranking, una sola vez", async () => {
    const ocupadas = await llenar();
    // A1 tiene además una reserva de 12:00 a 14:00, así que no sirve para quien necesita 09:00–14:00.
    const tarde = await nuevaCuenta();
    await solicitar(tarde.token, visita({ llegada: "12:00", salida: "14:00" })).expect(201);

    const incompatible = await nuevaCuenta();
    const baja = await nuevaCuenta();
    const alta = await nuevaCuenta();
    await puntaje(incompatible.id, 50);
    await puntaje(baja.id, -20);
    await esperar(incompatible.token, { ...visita({ salida: "14:00" }), consentimiento: true }).expect(201);
    await esperar(baja.token, { ...visita(), consentimiento: true }).expect(201);
    await esperar(alta.token, { ...visita(), consentimiento: true }).expect(201);

    const a1 = ocupadas.find(({ reserva }) => reserva.plaza.codigo === "A1");
    await conToken(a1.token, "post", `/reservas/${a1.reserva.id}/cancelar`).expect(200);

    const estados = async (cuenta) => (await conToken(cuenta.token, "get", "/esperas").expect(200)).body.esperas[0];
    expect(await estados(incompatible)).toMatchObject({ estado: "pendiente" });
    expect(await estados(baja)).toMatchObject({ estado: "pendiente" });
    const asignada = await estados(alta);
    expect(asignada).toMatchObject({ estado: "asignada" });
    const reserva = await conToken(alta.token, "get", `/reservas/${asignada.reservaId}`).expect(200);
    expect(reserva.body.reserva).toMatchObject({ estado: "confirmada", plaza: { codigo: "A1" } });

    // Volver a procesar no duplica la asignación.
    await conToken(a1.token, "post", `/reservas/${a1.reserva.id}/cancelar`).expect(200);
    expect(await db.reserva.count({ where: { cuentaId: alta.id } })).toBe(1);
    expect(await db.solicitudEspera.count({ where: { estado: "asignada" } })).toBe(1);
  });

  test("una espera cancelada no se asigna y las vencidas se cierran", async () => {
    const ocupadas = await llenar();
    const cuenta = await nuevaCuenta();
    const espera = (await esperar(cuenta.token, { ...visita(), consentimiento: true }).expect(201)).body.espera;
    await conToken(cuenta.token, "post", `/esperas/${espera.id}/cancelar`).expect(200);
    await conToken(ocupadas[0].token, "post", `/reservas/${ocupadas[0].reserva.id}/cancelar`).expect(200);
    expect(await db.reserva.count({ where: { cuentaId: cuenta.id } })).toBe(0);

    // Otra persona ocupa la plaza liberada; la nueva espera queda pendiente y pasa su ventana de llegada.
    await solicitar((await nuevaCuenta()).token).expect(201);
    const otra = await nuevaCuenta();
    const pendiente = await esperar(otra.token, { ...visita({ llegada: "10:00", salida: "11:00" }), consentimiento: true }).expect(201);
    expect(pendiente.body.espera.estado).toBe("pendiente");
    clock.set("2026-11-16T13:16:00.000Z");
    const admin = await nuevaCuenta();
    await db.cuenta.update({ where: { id: admin.id }, data: { rol: "admin" } });
    await conToken(admin.token, "post", "/admin/procesos/vencimientos").expect(200);
    expect((await db.solicitudEspera.findFirstOrThrow({ where: { cuentaId: otra.id } })).estado).toBe("vencida");
  });
});

describe("PP-25 · rendimiento", () => {
  test("50 solicitudes concurrentes responden en menos de 5 s sin dobles reservas", async () => {
    const cuentas = await Promise.all(Array.from({ length: 50 }, () => nuevaCuenta(appSimultanea)));
    const inicio = Date.now();
    const respuestas = await Promise.all(
      cuentas.map(async ({ token }) => {
        const t0 = Date.now();
        const r = await solicitar(token, visita(), appSimultanea);
        return { status: r.status, ms: Date.now() - t0 };
      }),
    );
    const total = Date.now() - inicio;
    const maximo = Math.max(...respuestas.map((r) => r.ms));
    console.log(`PP-25: 50 solicitudes, máximo ${maximo} ms, total ${total} ms (ventana ${VENTANA_MS} ms).`);
    expect(maximo).toBeLessThan(5000);
    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(5);
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(45);
    const plazas = await db.reserva.findMany({ where: { estado: "confirmada" }, select: { plazaId: true } });
    expect(new Set(plazas.map((p) => p.plazaId)).size).toBe(plazas.length);
  }, 60_000);
});
