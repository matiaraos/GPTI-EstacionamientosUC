import request from "supertest";
import { createApp } from "../dist/app.js";
import { sembrarPlazasDemo } from "../dist/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../dist/modules/catalogo/importar.js";
import { resolverQr } from "../dist/modules/catalogo/qr.js";
import { tieneAutorizacionVigente } from "../dist/modules/inventario/autorizaciones.js";
import { createClock, datosRegistro, registrarEIniciar, testConfig } from "./helpers/app.js";
import { createTestDatabase, resetDatabase } from "./helpers/db.js";

const db = createTestDatabase();
// Lunes 16 de noviembre de 2026, 07:00 en Santiago.
const clock = createClock("2026-11-16T10:00:00.000Z");
const app = createApp({ config: testConfig, db, clock });
let destinoId;
let admin;
let siguienteCuenta = 100;
let siguienteClave = 1;

const visita = (cambios = {}) => ({ fecha: "2026-11-16", llegada: "09:00", salida: "12:00", destinoId, ...cambios });
const nuevaCuenta = () => registrarEIniciar(app, datosRegistro(String(siguienteCuenta++)));
const solicitar = (token, body = visita()) =>
  request(app).post("/reservas").set("Authorization", `Bearer ${token}`).set("Idempotency-Key", `clave-inv-${siguienteClave++}`).send(body);
const comoAdmin = (metodo, ruta) => request(app)[metodo](ruta).set("Authorization", `Bearer ${admin}`);
const plaza = (codigo) => db.plaza.findFirstOrThrow({ where: { codigo } });
const asignada = (response) => `${response.body.reserva.plaza.codigo}`;

beforeAll(async () => {
  await resetDatabase(db);
  await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  await sembrarPlazasDemo(db);
  ({ id: destinoId } = await db.destino.findUniqueOrThrow({ where: { idOrigen: "ED113-SJ" } }));
  admin = await registrarEIniciar(app, datosRegistro("1"));
  await db.cuenta.update({ where: { correo: datosRegistro("1").correo }, data: { rol: "admin" } });
}, 30_000);

beforeEach(async () => {
  await db.ajusteRanking.deleteMany();
  await db.reserva.deleteMany();
  await db.bloqueoPlaza.deleteMany();
  await db.autorizacionPreferente.deleteMany();
  await db.plaza.updateMany({ data: { activa: true, tipo: "regular" } });
  await db.zona.updateMany({ data: { activa: true } });
  await db.destino.updateMany({ data: { activo: true } });
  await sembrarPlazasDemo(db);
  clock.set("2026-11-16T10:00:00.000Z");
});

afterAll(() => db.$disconnect());

describe("permisos", () => {
  test("una cuenta común no puede cambiar inventario ni autorizaciones", async () => {
    const token = await nuevaCuenta();
    const a1 = await plaza("A1");
    const zona = await db.zona.findUniqueOrThrow({ where: { idOrigen: "PARKING-7" } });
    const cuenta = await db.cuenta.findFirstOrThrow({ where: { rol: "usuario" } });
    const operaciones = [
      ["get", "/admin/zonas"],
      ["post", "/admin/zonas", { nombre: "Nueva" }],
      ["patch", `/admin/zonas/${zona.id}`, { activa: false }],
      ["put", `/admin/zonas/${zona.id}/horarios`, { horarios: [] }],
      ["post", "/admin/plazas", { zonaId: zona.id, codigo: "Z9" }],
      ["patch", `/admin/plazas/${a1.id}`, { activa: false }],
      ["post", `/admin/plazas/${a1.id}/qr`],
      ["delete", `/admin/plazas/${a1.id}/qr`],
      ["post", "/admin/bloqueos", { plazaId: a1.id, inicio: "2026-11-16T08:00", fin: "2026-11-16T18:00", motivo: "Prueba" }],
      ["patch", `/admin/destinos/${destinoId}`, { activo: false }],
      ["put", `/admin/cuentas/${cuenta.id}/autorizacion`, { vigenteHasta: "2026-12-31" }],
      ["post", `/admin/cuentas/${cuenta.id}/autorizacion/revocar`],
    ];
    for (const [metodo, ruta, body] of operaciones) {
      const response = await request(app)[metodo](ruta).set("Authorization", `Bearer ${token}`).send(body);
      expect([ruta, response.status]).toEqual([ruta, 403]);
    }
    await request(app).post("/admin/zonas").send({ nombre: "Sin sesión" }).expect(401);
    expect(await db.plaza.findUniqueOrThrow({ where: { id: a1.id } })).toMatchObject({ activa: true });
    expect(await db.bloqueoPlaza.count()).toBe(0);
    expect(await db.autorizacionPreferente.count()).toBe(0);
  });
});

describe("plazas excluidas de nuevas asignaciones", () => {
  test("una plaza bloqueada se excluye durante el bloqueo y vuelve al levantarlo", async () => {
    const a1 = await plaza("A1");
    const a2 = await plaza("A2");
    const bloqueos = [];
    for (const { id } of [a1, a2]) {
      const response = await comoAdmin("post", "/admin/bloqueos")
        .send({ plazaId: id, inicio: "2026-11-16T08:00", fin: "2026-11-16T13:00", motivo: "Mantención de la demarcación" })
        .expect(201);
      bloqueos.push(response.body.bloqueo.id);
    }
    const bloqueada = await solicitar(await nuevaCuenta()).expect(201);
    expect(bloqueada.body.reserva.zona.nombre).not.toBe("Est. Subterráneo Centro de innovación");
    // Fuera del bloqueo, A1 vuelve a ser la primera opción.
    const despues = await solicitar(await nuevaCuenta(), visita({ llegada: "13:00", salida: "15:00" })).expect(201);
    expect(asignada(despues)).toBe("A1");

    await comoAdmin("post", `/admin/bloqueos/${bloqueos[0]}/levantar`).expect(200);
    const levantado = await solicitar(await nuevaCuenta()).expect(201);
    expect(asignada(levantado)).toBe("A1");
    const historial = await comoAdmin("get", "/admin/bloqueos?todos=1").expect(200);
    expect(historial.body.bloqueos).toHaveLength(2);
    const vigentes = await comoAdmin("get", "/admin/bloqueos").expect(200);
    expect(vigentes.body.bloqueos.map((b) => b.id)).toEqual([bloqueos[1]]);
  });

  test("bloquear advierte de las reservas afectadas y valida el intervalo", async () => {
    const reserva = await solicitar(await nuevaCuenta()).expect(201);
    const a1 = await plaza("A1");
    const response = await comoAdmin("post", "/admin/bloqueos")
      .send({ plazaId: a1.id, inicio: "2026-11-16T10:00", fin: "2026-11-16T11:00", motivo: "Derrame de aceite" })
      .expect(201);
    expect(response.body.reservasAfectadas.map((r) => r.id)).toEqual([reserva.body.reserva.id]);
    expect(response.body.reservasAfectadas[0].cuenta.correo).toMatch(/@demo\.uc\.cl$/);
    expect(response.body.bloqueo).toMatchObject({ inicioLocal: "2026-11-16 10:00", finLocal: "2026-11-16 11:00" });

    const invalido = await comoAdmin("post", "/admin/bloqueos")
      .send({ plazaId: a1.id, inicio: "2026-11-16T11:00", fin: "2026-11-16T10:00", motivo: "x" })
      .expect(400);
    expect(Object.keys(invalido.body.error.details).sort()).toEqual(["fin", "motivo"]);
  });

  test("desactivar una plaza conserva su historial, advierte y la excluye", async () => {
    const reserva = await solicitar(await nuevaCuenta()).expect(201);
    const a1 = await plaza("A1");
    const previa = await comoAdmin("get", `/admin/plazas/${a1.id}/reservas-afectadas`).expect(200);
    expect(previa.body.reservas).toHaveLength(1);
    const response = await comoAdmin("patch", `/admin/plazas/${a1.id}`).send({ activa: false }).expect(200);
    expect(response.body.plaza.activa).toBe(false);
    expect(response.body.reservasAfectadas.map((r) => r.id)).toEqual([reserva.body.reserva.id]);
    // La reserva existente no se borra ni se cancela sola.
    expect(await db.reserva.findUniqueOrThrow({ where: { id: reserva.body.reserva.id } })).toMatchObject({ estado: "confirmada" });

    const siguiente = await solicitar(await nuevaCuenta(), visita({ llegada: "13:00", salida: "15:00" })).expect(201);
    expect(asignada(siguiente)).toBe("A2");
    expect(await db.plaza.count({ where: { id: a1.id } })).toBe(1);
  });

  test("un bloque inactivo o cerrado ese día se excluye", async () => {
    const zona = await db.zona.findUniqueOrThrow({ where: { idOrigen: "PARKING-7" } });
    await comoAdmin("patch", `/admin/zonas/${zona.id}`).send({ activa: false }).expect(200);
    expect((await solicitar(await nuevaCuenta()).expect(201)).body.reserva.plaza.codigo).toBe("B1");
    await comoAdmin("patch", `/admin/zonas/${zona.id}`).send({ activa: true }).expect(200);

    // Sin el lunes en su horario, PARKING-7 queda cerrado ese día.
    const horarios = [2, 3, 4, 5].map((diaSemana) => ({ diaSemana, abre: "07:00", cierra: "22:00" }));
    await comoAdmin("put", `/admin/zonas/${zona.id}/horarios`).send({ horarios }).expect(200);
    expect((await solicitar(await nuevaCuenta()).expect(201)).body.reserva.plaza.codigo).toBe("B2");
    const listado = await comoAdmin("get", "/admin/zonas").expect(200);
    expect(listado.body.zonas.find((z) => z.id === zona.id).horarios).toHaveLength(4);

    const invalido = await comoAdmin("put", `/admin/zonas/${zona.id}/horarios`)
      .send({ horarios: [{ diaSemana: 1, abre: "10:00", cierra: "09:00" }] })
      .expect(400);
    expect(invalido.body.error.details["horarios.0.cierra"]).toMatch(/posterior/);
  });
});

describe("plazas regulares y preferentes", () => {
  test("se distinguen y una cuenta sin habilitación no recibe una preferente", async () => {
    const a1 = await plaza("A1");
    await comoAdmin("patch", `/admin/plazas/${a1.id}`).send({ tipo: "preferente" }).expect(200);
    const listado = await comoAdmin("get", "/admin/plazas").expect(200);
    expect(listado.body.plazas.find((p) => p.codigo === "A1").tipo).toBe("preferente");
    expect(listado.body.plazas.filter((p) => p.tipo === "regular")).toHaveLength(4);
    expect(asignada(await solicitar(await nuevaCuenta()).expect(201))).toBe("A2");
  });

  test("crear plaza emite su QR y rechaza códigos duplicados en el bloque", async () => {
    const zona = await db.zona.findUniqueOrThrow({ where: { idOrigen: "PARKING-7" } });
    const nueva = await comoAdmin("post", "/admin/plazas").send({ zonaId: zona.id, codigo: "a9", tipo: "preferente" }).expect(201);
    expect(nueva.body.plaza).toMatchObject({ codigo: "A9", tipo: "preferente", activa: true });
    expect((await resolverQr(db, nueva.body.plaza.qr)).plaza.codigo).toBe("A9");
    const repetida = await comoAdmin("post", "/admin/plazas").send({ zonaId: zona.id, codigo: "A9" }).expect(409);
    expect(repetida.body.error.details.codigo).toBeDefined();
    await db.qrPlaza.deleteMany({ where: { plaza: { codigo: "A9" } } });
    await db.plaza.delete({ where: { id: nueva.body.plaza.id } });
  });
});

describe("QR", () => {
  test("rotar reemplaza el QR vigente y revocar lo deja sin QR", async () => {
    const a1 = await plaza("A1");
    const antes = (await comoAdmin("get", "/admin/plazas").expect(200)).body.plazas.find((p) => p.id === a1.id).qr;
    const rotado = await comoAdmin("post", `/admin/plazas/${a1.id}/qr`).expect(201);
    expect(rotado.body.qr).not.toBe(antes);
    await expect(resolverQr(db, antes)).rejects.toMatchObject({ code: "qr_revocado" });
    expect((await resolverQr(db, rotado.body.qr)).plaza.id).toBe(a1.id);

    await comoAdmin("delete", `/admin/plazas/${a1.id}/qr`).expect(204);
    await expect(resolverQr(db, rotado.body.qr)).rejects.toMatchObject({ code: "qr_revocado" });
    expect((await comoAdmin("get", "/admin/plazas").expect(200)).body.plazas.find((p) => p.id === a1.id).qr).toBeNull();
  });
});

describe("edificios y destinos", () => {
  test("un destino desactivado deja de aceptarse en una visita", async () => {
    await comoAdmin("patch", `/admin/destinos/${destinoId}`).send({ activo: false }).expect(200);
    const response = await solicitar(await nuevaCuenta()).expect(400);
    expect(response.body.error.details.destinoId).toBeDefined();
    const edificios = await comoAdmin("get", "/admin/destinos?tipo=edificio").expect(200);
    expect(edificios.body.destinos.length).toBeGreaterThan(0);
    expect(edificios.body.destinos.every((d) => d.tipo === "edificio")).toBe(true);
  });
});

describe("habilitaciones preferentes", () => {
  test("una habilitación vence o se revoca y deja de ser válida", async () => {
    const token = await nuevaCuenta();
    const cuenta = (await request(app).get("/cuenta").set("Authorization", `Bearer ${token}`).expect(200)).body.cuenta;
    expect(cuenta.autorizacionPreferente).toBeNull();

    const otorgada = await comoAdmin("put", `/admin/cuentas/${cuenta.id}/autorizacion`).send({ vigenteHasta: "2026-11-20" }).expect(200);
    // Vigente hasta el fin del 20 de noviembre en Santiago (21-11 00:00 = 03:00 UTC en horario de verano).
    expect(otorgada.body.autorizacion).toMatchObject({ estado: "vigente", vigenteHasta: "2026-11-21T03:00:00.000Z" });
    const propia = await request(app).get("/cuenta").set("Authorization", `Bearer ${token}`).expect(200);
    expect(propia.body.cuenta.autorizacionPreferente).toMatchObject({ estado: "vigente" });
    expect(await tieneAutorizacionVigente(db, cuenta.id, clock())).toBe(true);

    clock.set("2026-11-21T03:00:00.000Z");
    expect(await tieneAutorizacionVigente(db, cuenta.id, clock())).toBe(false);
    // La sesión del administrador de prueba dura 24 horas: se abre otra en la nueva fecha.
    const { correo, contrasena } = datosRegistro("1");
    const otraSesion = (await request(app).post("/auth/sesion").send({ correo, contrasena }).expect(201)).body.token;
    const vencida = await request(app).get("/admin/autorizaciones").set("Authorization", `Bearer ${otraSesion}`).expect(200);
    expect(vencida.body.autorizaciones[0]).toMatchObject({ estado: "vencida", cuenta: { id: cuenta.id } });

    clock.set("2026-11-16T10:00:00.000Z");
    await comoAdmin("put", `/admin/cuentas/${cuenta.id}/autorizacion`).send({ vigenteHasta: "2026-12-31" }).expect(200);
    const revocada = await comoAdmin("post", `/admin/cuentas/${cuenta.id}/autorizacion/revocar`).expect(200);
    expect(revocada.body.autorizacion.estado).toBe("revocada");
    expect(await tieneAutorizacionVigente(db, cuenta.id, clock())).toBe(false);
  });

  test("solo se registra la vigencia, sin certificados ni motivos médicos", async () => {
    await nuevaCuenta();
    const cuenta = await db.cuenta.findFirstOrThrow({ where: { rol: "usuario" }, orderBy: { id: "desc" } });
    const response = await comoAdmin("put", `/admin/cuentas/${cuenta.id}/autorizacion`)
      .send({ vigenteHasta: "2026-12-31", motivo: "diagnóstico", certificado: "archivo.pdf" })
      .expect(400);
    expect(response.body.error.details.solicitud).toMatch(/motivos médicos/);
    expect(await db.autorizacionPreferente.count()).toBe(0);
    const columnas = await db.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'AutorizacionPreferente' ORDER BY column_name`;
    expect(columnas.map((c) => c.column_name)).toEqual(["cuentaId", "otorgadaEn", "otorgadaPorId", "revocadaEn", "vigenteHasta"]);
    const pasada = await comoAdmin("put", `/admin/cuentas/${cuenta.id}/autorizacion`).send({ vigenteHasta: "2026-11-01" }).expect(400);
    expect(pasada.body.error.details.vigenteHasta).toBeDefined();
  });
});
