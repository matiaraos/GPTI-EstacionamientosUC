import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esViolacionUnica } from "../../lib/prisma-errors.js";
import { partesLocales } from "../../lib/tiempo.js";
import { parseInput } from "../../lib/validation.js";
import { requiereRol, requiereSesion, sesionDe } from "../cuentas/sesiones.js";
import { calcularIndicadores } from "./indicadores.js";

type Deps = { db: Database; clock: Clock };

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida (AAAA-MM-DD).");
const periodoSchema = z
  .object({ desde: fecha, hasta: fecha, modo: z.enum(["real", "simulacion"]).default("real") })
  .refine((p) => p.hasta >= p.desde, { message: "El término debe ser igual o posterior al inicio.", path: ["hasta"] });

const encuestaSchema = z.object({
  reservaId: z.number({ error: "Indica la reserva." }).int().positive(),
  puntaje: z.number({ error: "Elige de 1 a 5." }).int().min(1, "Elige de 1 a 5.").max(5, "Elige de 1 a 5."),
  comentario: z.string().trim().max(500).nullish(),
});

const medicionSchema = z
  .object({
    desde: fecha,
    hasta: fecha,
    porcentaje: z.number({ error: "Indica el porcentaje." }).min(0).max(100),
    fuente: z.string({ error: "Indica la fuente." }).trim().min(2).max(80),
    simulada: z.boolean().default(false),
  })
  .refine((m) => m.hasta >= m.desde, { message: "El término debe ser igual o posterior al inicio.", path: ["hasta"] });

const dia = (f: string) => new Date(`${f}T00:00:00Z`);
const texto = (d: Date) => d.toISOString().slice(0, 10);

/** Encuesta de satisfacción e indicadores agregados del piloto (08B). */
export function crearRutasPiloto({ db, clock }: Deps) {
  const router = Router();
  const admin = [requiereSesion(db, clock), requiereRol("admin")];

  /** Satisfacción tras usar la plaza (1 a 5). Una respuesta por reserva; repetirla no la cambia. */
  router.post("/encuestas", requiereSesion(db, clock), async (request, response) => {
    const datos = parseInput(encuestaSchema, request.body);
    const reserva = await db.reserva.findFirst({ where: { id: datos.reservaId, cuentaId: sesionDe(response).cuentaId }, select: { estado: true } });
    if (!reserva) throw new HttpError(404, "reserva_no_encontrada", "No encontramos esa reserva.");
    if (!["finalizada", "vencida"].includes(reserva.estado)) {
      throw new HttpError(409, "encuesta_prematura", "Podrás evaluar la reserva después de registrar tu salida.");
    }
    try {
      await db.encuestaSatisfaccion.create({ data: { ...datos, comentario: datos.comentario || null, creadaEn: clock() } });
      response.status(201).json({ mensaje: "¡Gracias por tu respuesta!" });
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
      response.json({ mensaje: "Ya habías respondido por esta reserva." });
    }
  });

  router.get("/admin/indicadores", ...admin, async (request, response) => {
    const hoy = partesLocales(clock()).fecha;
    const { desde, hasta, modo } = parseInput(periodoSchema, { desde: hoy, hasta: hoy, ...request.query });
    response.json(await calcularIndicadores(db, desde, hasta, modo));
  });

  router.get("/admin/indicadores/mediciones", ...admin, async (_request, response) => {
    const mediciones = await db.medicionDisponibilidad.findMany({ orderBy: { desde: "desc" }, take: 100 });
    response.json({ mediciones: mediciones.map((m) => ({ ...m, desde: texto(m.desde), hasta: texto(m.hasta) })) });
  });

  /** Disponibilidad medida fuera de la API (UptimeRobot sobre `/ready`). */
  router.post("/admin/indicadores/mediciones", ...admin, async (request, response) => {
    const datos = parseInput(medicionSchema, request.body);
    const medicion = await db.medicionDisponibilidad.create({
      data: { ...datos, desde: dia(datos.desde), hasta: dia(datos.hasta), registradaEn: clock(), registradaPorId: sesionDe(response).cuentaId },
    });
    response.status(201).json({ medicion: { ...medicion, desde: texto(medicion.desde), hasta: texto(medicion.hasta) } });
  });

  /** Guarda el resultado agregado y anónimo del período. Es lo que se conserva al cerrar el piloto. */
  router.post("/admin/indicadores/resultados", ...admin, async (request, response) => {
    const { desde, hasta, modo } = parseInput(periodoSchema, request.body);
    const reporte = await calcularIndicadores(db, desde, hasta, modo);
    const resultado = await db.resultadoPiloto.create({
      data: { desde: dia(desde), hasta: dia(hasta), modo, generadoEn: clock(), indicadores: reporte.indicadores },
    });
    response.status(201).json({ resultado: { ...resultado, desde, hasta } });
  });

  router.get("/admin/indicadores/resultados", ...admin, async (_request, response) => {
    const resultados = await db.resultadoPiloto.findMany({ orderBy: { generadoEn: "desc" }, take: 50 });
    response.json({ resultados: resultados.map((r) => ({ ...r, desde: texto(r.desde), hasta: texto(r.hasta) })) });
  });

  return router;
}
