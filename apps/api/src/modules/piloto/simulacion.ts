import bcrypt from "bcrypt";
import type { RankingConfig, ReservasConfig } from "../../config.js";
import { HttpError } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { instanteLocal, partesLocales } from "../../lib/tiempo.js";
import { bloquesDeActividad } from "../catalogo/cursos-uc.js";
import { contenidoQr } from "../catalogo/qr.js";
import { procesarVencimientos } from "../ranking/vencimientos.js";
import { reservar } from "../reservas/asignacion.js";
import { registrarEntrada, registrarSalida } from "../reservas/uso.js";
import { validarVisita } from "../visitas/validacion.js";

/** Punto publicado del bloque PARKING-7, dentro del perímetro del campus. */
const EN_CAMPUS = { latitud: -33.4975513178705, longitud: -70.61532261345947 };

/** Generador pseudoaleatorio con semilla, para que la simulación sea reproducible. */
function azar(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sumarDias = (f: string, n: number) => new Date(Date.parse(`${f}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export type OpcionesSimulacion = {
  desde: string;
  dias: number;
  usuarios: number;
  semilla?: number;
  dominio: string;
  reservas: ReservasConfig;
  ranking: RankingConfig;
};

/**
 * Simula el uso del piloto con cuentas ficticias marcadas como `simulada`: horarios de los estudiantes
 * de prueba, solicitudes diarias, llegadas y salidas con QR (algunas lecturas fallidas y ausencias),
 * encuestas y una medición de disponibilidad. Usa los mismos servicios que la API con un reloj propio.
 * Sus resultados se reportan aparte y no acreditan las metas reales.
 */
export async function simularPiloto(db: Database, opciones: OpcionesSimulacion) {
  const r = azar(opciones.semilla ?? 2026);
  let ahora = new Date();
  const clock = () => new Date(ahora);
  const resumen = { cuentas: 0, solicitudes: 0, reservas: 0, sinCupo: 0, entradas: 0, salidas: 0, encuestas: 0 };

  const perfiles = await db.perfilUC.findMany({ orderBy: { codigo: "asc" } });
  const actividades = await db.actividadUC.findMany({ where: { destinoId: { not: null } }, include: { curso: true } });
  const destinoDeclarado = await db.destino.findFirst({ where: { idOrigen: "ED113-SJ" } });
  const qrs = new Map((await db.qrPlaza.findMany({ where: { revocadoEn: null } })).map((q) => [q.plazaId, contenidoQr(q.identificador)]));
  const hash = await bcrypt.hash("simulacion-piloto", 4);

  const cuentas: number[] = [];
  for (let i = 1; i <= opciones.usuarios; i++) {
    const correo = `sim-${i}@${opciones.dominio}`;
    const patente = `SM${String(i).padStart(4, "0")}`;
    const cuenta = await db.cuenta.upsert({
      where: { correo },
      create: { correo, hashContrasena: hash, simulada: true, vehiculos: { create: { patente } } },
      update: {},
    });
    cuentas.push(cuenta.id);
    // Nueve de cada diez tienen horario: el de uno de los estudiantes de prueba.
    if (r() < 0.9 && perfiles.length && (await db.bloqueClase.count({ where: { cuentaId: cuenta.id } })) === 0) {
      const perfil = perfiles[i % perfiles.length];
      const ocupados: { dia: number; ini: string; fin: string }[] = [];
      for (const a of actividades.filter((x) => perfil.nrcs.includes(x.curso.nrc))) {
        for (const b of bloquesDeActividad(a)) {
          if (ocupados.some((o) => o.dia === b.diaSemana && o.ini < b.fin && b.inicio < o.fin)) continue;
          ocupados.push({ dia: b.diaSemana, ini: b.inicio, fin: b.fin });
          const [h1, m1] = b.inicio.split(":").map(Number);
          const [h2, m2] = b.fin.split(":").map(Number);
          await db.bloqueClase.create({
            data: { cuentaId: cuenta.id, destinoId: a.destinoId!, diaSemana: b.diaSemana, inicioMinuto: h1 * 60 + m1, finMinuto: h2 * 60 + m2, origen: "uc", actividadUCId: a.id },
          });
        }
      }
    }
  }
  resumen.cuentas = cuentas.length;

  for (let d = 0; d < opciones.dias; d++) {
    const fecha = sumarDias(opciones.desde, d);
    const inicioDia = instanteLocal(fecha, "07:00")!;
    if (partesLocales(inicioDia).diaSemana > 5) continue;
    ahora = new Date(inicioDia.getTime() - 12 * 3_600_000);
    const del_dia: { cuentaId: number; reservaId: number; plazaId: number; inicio: Date; fin: Date }[] = [];
    for (const cuentaId of cuentas) {
      if (r() > 0.6) continue;
      resumen.solicitudes++;
      const clases = await db.bloqueClase.findMany({ where: { cuentaId, diaSemana: partesLocales(inicioDia).diaSemana }, orderBy: { inicioMinuto: "asc" } });
      const llegada = clases.length ? hhmm(Math.max(7 * 60, clases[0].inicioMinuto - 15)) : "09:00";
      const salida = clases.length ? hhmm(Math.min(22 * 60, clases.at(-1)!.finMinuto + 10)) : "13:00";
      const vehiculo = await db.vehiculo.findFirstOrThrow({ where: { cuentaId } });
      try {
        const visita = await validarVisita(db, { fecha, llegada, salida, destinoId: clases.length ? undefined : destinoDeclarado?.id }, cuentaId);
        const { reserva } = await reservar(db, clock, opciones.reservas, {
          cuentaId,
          vehiculoId: vehiculo.id,
          visita,
          claveIdempotencia: `simulacion:${fecha}:${cuentaId}`,
        });
        resumen.reservas++;
        del_dia.push({ cuentaId, reservaId: reserva.id, plazaId: reserva.plazaId, inicio: reserva.inicio, fin: reserva.fin });
      } catch (error) {
        if (error instanceof HttpError) resumen.sinCupo++;
        else throw error;
      }
    }
    for (const reserva of del_dia.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
      if (r() < 0.06) continue; // ausencia
      const qr = qrs.get(reserva.plazaId)!;
      ahora = new Date(reserva.inicio.getTime() + Math.round((r() * 20 - 10) * 60_000));
      if (r() < 0.04) {
        await db.lecturaQR.create({ data: { reservaId: reserva.reservaId, tipo: "entrada", resultado: "qr_ilegible", registradoEn: clock() } });
      }
      try {
        await registrarEntrada(db, clock, opciones.reservas, { cuentaId: reserva.cuentaId, reservaId: reserva.reservaId, qr, ...EN_CAMPUS });
        await db.lecturaQR.create({ data: { reservaId: reserva.reservaId, tipo: "entrada", resultado: "ok", registradoEn: clock() } });
        resumen.entradas++;
      } catch (error) {
        if (error instanceof HttpError) continue;
        throw error;
      }
    }
    for (const reserva of [...del_dia].sort((a, b) => a.fin.getTime() - b.fin.getTime())) {
      if (r() < 0.03) continue; // olvida la salida
      ahora = new Date(reserva.fin.getTime() - Math.round(r() * 25 * 60_000));
      try {
        await registrarSalida(db, clock, opciones.reservas, opciones.ranking, { cuentaId: reserva.cuentaId, reservaId: reserva.reservaId, qr: qrs.get(reserva.plazaId)! });
        await db.lecturaQR.create({ data: { reservaId: reserva.reservaId, tipo: "salida", resultado: "ok", registradoEn: clock() } });
        resumen.salidas++;
        if (r() < 0.7) {
          const puntaje = r() < 0.86 ? (r() < 0.6 ? 5 : 4) : r() < 0.5 ? 3 : 2;
          await db.encuestaSatisfaccion.create({ data: { reservaId: reserva.reservaId, puntaje, creadaEn: clock() } });
          resumen.encuestas++;
        }
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
      }
    }
    ahora = instanteLocal(fecha, "23:30")!;
    await procesarVencimientos(db, clock(), opciones.reservas, opciones.ranking);
  }
  await db.medicionDisponibilidad.create({
    data: {
      desde: new Date(`${opciones.desde}T00:00:00Z`),
      hasta: new Date(`${sumarDias(opciones.desde, opciones.dias - 1)}T00:00:00Z`),
      porcentaje: 99.2,
      fuente: "Simulación",
      simulada: true,
      registradaEn: new Date(),
    },
  });
  return resumen;
}
