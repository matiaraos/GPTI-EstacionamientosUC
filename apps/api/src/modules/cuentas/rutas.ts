import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import type { Clock } from "../../app.js";
import type { AuthConfig } from "../../config.js";
import type { Mailer } from "../../lib/correo.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esViolacionUnica } from "../../lib/prisma-errors.js";
import { parseInput } from "../../lib/validation.js";
import { dominioDeCorreo, esPatenteChilenaValida, normalizarCorreo, normalizarPatente } from "./normalizacion.js";
import { estadoAutorizacion } from "../inventario/autorizaciones.js";
import { contrasenaNueva } from "./contrasena.js";
import { crearRutasRecuperacion } from "./recuperacion.js";
import { crearSesion, requiereRol, requiereSesion, sesionDe } from "./sesiones.js";

type Deps = { db: Database; clock: Clock; auth: AuthConfig; mailer: Mailer };

function registroSchema(dominios: string[]) {
  const lista = dominios.map((dominio) => `@${dominio}`).join(" o ");
  return z.object({
    correo: z
      .string({ error: "Ingresa tu correo." })
      .transform(normalizarCorreo)
      .pipe(z.email("Ingresa un correo válido."))
      .refine((correo) => dominios.includes(dominioDeCorreo(correo)), `Usa tu correo institucional (${lista}).`),
    contrasena: contrasenaNueva,
    patente: z
      .string({ error: "Ingresa la patente de tu vehículo." })
      .transform(normalizarPatente)
      .refine(esPatenteChilenaValida, "Ingresa una patente chilena válida, por ejemplo AB1234 o BCDF12."),
  });
}

const inicioSchema = z.object({
  correo: z.string({ error: "Ingresa tu correo." }).min(1, "Ingresa tu correo.").transform(normalizarCorreo),
  contrasena: z.string({ error: "Ingresa tu contraseña." }).min(1, "Ingresa tu contraseña."),
});

const credencialesInvalidas = () =>
  new HttpError(401, "credenciales_invalidas", "El correo o la contraseña no son correctos.");

const cuentaPublica = {
  id: true,
  correo: true,
  rol: true,
  vehiculos: { select: { id: true, patente: true }, orderBy: { id: "asc" } },
} as const;

export function crearRutasCuentas({ db, clock, auth, mailer }: Deps) {
  const router = Router();
  router.use(crearRutasRecuperacion({ db, clock, auth, mailer }));
  const conSesion = requiereSesion(db, clock);
  // Hash de referencia para que una cuenta inexistente tarde lo mismo que una contraseña incorrecta.
  const hashReferencia = bcrypt.hash("contraseña-de-referencia", auth.bcryptRounds);

  router.post("/auth/registro", async (request, response) => {
    const datos = parseInput(registroSchema(auth.allowedEmailDomains), request.body);
    const hashContrasena = await bcrypt.hash(datos.contrasena, auth.bcryptRounds);
    try {
      // La escritura anidada crea cuenta y vehículo en una sola transacción.
      const cuenta = await db.cuenta.create({
        data: { correo: datos.correo, hashContrasena, vehiculos: { create: { patente: datos.patente } } },
        select: cuentaPublica,
      });
      response.status(201).json({ cuenta });
    } catch (error) {
      if (!esViolacionUnica(error)) {
        throw error;
      }
      const correoUsado = await db.cuenta.findUnique({ where: { correo: datos.correo }, select: { id: true } });
      throw correoUsado
        ? new HttpError(409, "correo_registrado", "Ya existe una cuenta con este correo.", {
            correo: "Ya existe una cuenta con este correo.",
          })
        : new HttpError(409, "patente_registrada", "Esta patente ya está registrada en otra cuenta.", {
            patente: "Esta patente ya está registrada en otra cuenta.",
          });
    }
  });

  router.post("/auth/sesion", async (request, response) => {
    const datos = parseInput(inicioSchema, request.body);
    const cuenta = await db.cuenta.findUnique({
      where: { correo: datos.correo },
      select: { id: true, hashContrasena: true, activa: true },
    });
    const valida = await bcrypt.compare(datos.contrasena, cuenta?.hashContrasena ?? (await hashReferencia));
    if (!cuenta || !valida || !cuenta.activa) {
      throw credencialesInvalidas();
    }
    const { token, venceEn } = await crearSesion(db, cuenta.id, clock(), auth.sessionTtlHours);
    const publica = await db.cuenta.findUniqueOrThrow({ where: { id: cuenta.id }, select: cuentaPublica });
    response.status(201).json({ token, venceEn, cuenta: publica });
  });

  router.delete("/auth/sesion", conSesion, async (_request, response) => {
    const { sesionId } = sesionDe(response);
    await db.sesion.updateMany({ where: { id: sesionId, revocadaEn: null }, data: { revocadaEn: clock() } });
    response.status(204).end();
  });

  router.get("/cuenta", conSesion, async (_request, response) => {
    const { autorizacion, ...cuenta } = await db.cuenta.findUniqueOrThrow({
      where: { id: sesionDe(response).cuentaId },
      select: { ...cuentaPublica, autorizacion: { select: { vigenteHasta: true, revocadaEn: true } } },
    });
    // Solo el estado administrativo y la vigencia de la habilitación preferente (SC-002).
    const autorizacionPreferente = autorizacion
      ? { estado: estadoAutorizacion(autorizacion, clock()), vigenteHasta: autorizacion.vigenteHasta }
      : null;
    response.json({ cuenta: { ...cuenta, autorizacionPreferente } });
  });

  router.get("/admin/cuentas", conSesion, requiereRol("admin"), async (_request, response) => {
    const cuentas = await db.cuenta.findMany({
      select: { ...cuentaPublica, activa: true, creadaEn: true },
      orderBy: { id: "asc" },
    });
    response.json({ cuentas });
  });

  return router;
}
