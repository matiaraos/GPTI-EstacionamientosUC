import type { Database } from "../../lib/prisma.js";
import { instanteLocal } from "../../lib/tiempo.js";

export type Modo = "real" | "simulacion";

export type Indicador = {
  clave: string;
  nombre: string;
  /** Valor del indicador: cantidad o porcentaje (0–100). Nulo si no hay datos. */
  valor: number | null;
  unidad: "personas" | "%" | "pares";
  numerador: number | null;
  denominador: number | null;
  detalle: string;
  meta: string;
  cumple: boolean | null;
  /** PP-15 se mide aparte y no forma parte de las metas del certificado. */
  separado?: boolean;
};

export type ReporteIndicadores = { desde: string; hasta: string; modo: Modo; acredita: boolean; nota: string; indicadores: Indicador[] };

const siguiente = (f: string) => new Date(Date.parse(`${f}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const inicioDia = (f: string) => instanteLocal(f, "00:00") ?? instanteLocal(f, "01:00")!;
const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

/**
 * Indicadores agregados del período `[desde, hasta]` (días locales) para cuentas reales o simuladas.
 * Cada valor trae su numerador y denominador. Una simulación nunca acredita las metas del piloto.
 */
export async function calcularIndicadores(db: Database, desde: string, hasta: string, modo: Modo): Promise<ReporteIndicadores> {
  const ini = inicioDia(desde);
  const fin = inicioDia(siguiente(hasta));
  const simulada = modo === "simulacion";
  const reservas = { inicio: { gte: ini, lt: fin }, cuenta: { simulada } };

  const [total, conHorario, participantes, registradas, errores, encuestas, satisfechas, mediciones] = await Promise.all([
    db.reserva.count({ where: reservas }),
    db.reserva.count({ where: { ...reservas, origenDestino: "horario" } }),
    db.reserva.groupBy({ by: ["cuentaId"], where: reservas }).then((g) => g.length),
    db.cuenta.count({ where: { rol: "usuario", simulada, creadaEn: { lt: fin } } }),
    db.incidente.count({ where: { estado: { in: ["validado", "cerrado"] }, reserva: reservas } }),
    db.encuestaSatisfaccion.count({ where: { reserva: reservas } }),
    db.encuestaSatisfaccion.count({ where: { reserva: reservas, puntaje: { gte: 4 } } }),
    db.medicionDisponibilidad.findMany({ where: { simulada, desde: { lte: new Date(`${hasta}T00:00:00Z`) }, hasta: { gte: new Date(`${desde}T00:00:00Z`) } } }),
  ]);

  // Dobles reservas: pares de reservas de la misma plaza cuyo uso se superpone. El uso es de la entrada
  // a la salida registradas (o al fin de la reserva) y, si aún no hay entrada, el intervalo confirmado.
  const [{ dobles }] = await db.$queryRaw<{ dobles: bigint }[]>`
    WITH uso AS (
      SELECT r."id", r."plazaId",
        tstzrange(
          COALESCE(e."registradoEn", r."inicio"),
          GREATEST(COALESCE(s."registradoEn", r."fin"), COALESCE(e."registradoEn", r."inicio") + interval '1 second'),
          '[)') AS intervalo
      FROM "Reserva" r
      JOIN "Cuenta" c ON c."id" = r."cuentaId" AND c."simulada" = ${simulada}
      LEFT JOIN "EventoReserva" e ON e."reservaId" = r."id" AND e."tipo" = 'entrada'
      LEFT JOIN "EventoReserva" s ON s."reservaId" = r."id" AND s."tipo" = 'salida'
      WHERE r."inicio" >= ${ini} AND r."inicio" < ${fin}
        AND (r."estado" IN ('confirmada', 'en_uso') OR e."id" IS NOT NULL)
    )
    SELECT count(*) AS dobles FROM uso a JOIN uso b ON a."plazaId" = b."plazaId" AND a."id" < b."id" AND a.intervalo && b.intervalo`;

  // PP-15: reservas cuya primera lectura de entrada fue correcta.
  const [{ conLectura, primerIntento }] = await db.$queryRaw<{ conLectura: bigint; primerIntento: bigint }[]>`
    SELECT count(*) AS "conLectura", count(*) FILTER (WHERE primera."resultado" = 'ok') AS "primerIntento"
    FROM (
      SELECT DISTINCT ON (l."reservaId") l."reservaId", l."resultado"
      FROM "LecturaQR" l
      JOIN "Reserva" r ON r."id" = l."reservaId" AND r."inicio" >= ${ini} AND r."inicio" < ${fin}
      JOIN "Cuenta" c ON c."id" = r."cuentaId" AND c."simulada" = ${simulada}
      WHERE l."tipo" = 'entrada'
      ORDER BY l."reservaId", l."registradoEn", l."id"
    ) primera`;

  const disponibilidad = mediciones.length ? Math.round((mediciones.reduce((t, m) => t + m.porcentaje, 0) / mediciones.length) * 10) / 10 : null;
  const valorHorario = pct(conHorario, total);
  const valorErrores = pct(errores, total);
  const valorSatisfaccion = pct(satisfechas, encuestas);
  const valorQR = pct(Number(primerIntento), Number(conLectura));

  const indicadores: Indicador[] = [
    {
      clave: "participantes",
      nombre: "Participantes",
      valor: participantes,
      unidad: "personas",
      numerador: participantes,
      denominador: registradas,
      detalle: `${participantes} personas con al menos una reserva de ${registradas} cuentas registradas.`,
      meta: "≥ 50 personas",
      cumple: participantes >= 50,
    },
    {
      clave: "asignaciones_con_horario",
      nombre: "Asignaciones con horario",
      valor: valorHorario,
      unidad: "%",
      numerador: conHorario,
      denominador: total,
      detalle: `${conHorario} de ${total} reservas usaron el destino del horario académico.`,
      meta: "≥ 90 %",
      cumple: valorHorario === null ? null : valorHorario >= 90,
    },
    {
      clave: "satisfaccion",
      nombre: "Satisfacción",
      valor: valorSatisfaccion,
      unidad: "%",
      numerador: satisfechas,
      denominador: encuestas,
      detalle: `${satisfechas} de ${encuestas} respuestas con 4 o 5 de 5.`,
      meta: "≥ 80 %",
      cumple: valorSatisfaccion === null ? null : valorSatisfaccion >= 80,
    },
    {
      clave: "disponibilidad",
      nombre: "Disponibilidad",
      valor: disponibilidad,
      unidad: "%",
      numerador: null,
      denominador: mediciones.length || null,
      detalle: mediciones.length
        ? `Promedio de ${mediciones.length} mediciones externas (${[...new Set(mediciones.map((m) => m.fuente))].join(", ")}).`
        : "Sin mediciones registradas para el período.",
      meta: "> 95 %",
      cumple: disponibilidad === null ? null : disponibilidad > 95,
    },
    {
      clave: "errores_asignacion",
      nombre: "Errores de asignación",
      valor: valorErrores,
      unidad: "%",
      numerador: errores,
      denominador: total,
      detalle: `${errores} incidentes validados sobre ${total} reservas.`,
      meta: "< 5 %",
      cumple: valorErrores === null ? null : valorErrores < 5,
    },
    {
      clave: "dobles_reservas",
      nombre: "Dobles reservas",
      valor: Number(dobles),
      unidad: "pares",
      numerador: Number(dobles),
      denominador: total,
      detalle: `${Number(dobles)} pares de reservas con uso superpuesto en la misma plaza.`,
      meta: "0",
      cumple: Number(dobles) === 0,
    },
    {
      clave: "qr_primer_intento",
      nombre: "Lecturas QR al primer intento (PP-15)",
      valor: valorQR,
      unidad: "%",
      numerador: Number(primerIntento),
      denominador: Number(conLectura),
      detalle: `${Number(primerIntento)} de ${Number(conLectura)} llegadas se registraron con la primera lectura.`,
      meta: "≥ 95 %",
      cumple: valorQR === null ? null : valorQR >= 95,
      separado: true,
    },
  ];
  const metas = indicadores.filter((i) => !i.separado);
  return {
    desde,
    hasta,
    modo,
    acredita: modo === "real" && metas.every((i) => i.cumple === true),
    nota:
      modo === "simulacion"
        ? "Simulación con cuentas ficticias: sirve para probar el reporte y no acredita las metas del piloto."
        : "Medición con cuentas reales del piloto.",
    indicadores,
  };
}
