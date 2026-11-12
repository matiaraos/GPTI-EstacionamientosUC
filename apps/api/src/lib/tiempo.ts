/** Zona horaria en que se interpretan las fechas y horas de una visita. */
export const ZONA_HORARIA = "America/Santiago";

const partesFormato = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const DIAS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export type PartesLocales = {
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  minutoDelDia: number;
  /** 1 = lunes … 7 = domingo. */
  diaSemana: number;
};

/** Fecha, hora y día de la semana de un instante en Santiago. */
export function partesLocales(instante: Date): PartesLocales {
  const p = Object.fromEntries(partesFormato.formatToParts(instante).map((parte) => [parte.type, parte.value]));
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour}:${p.minute}`,
    minutoDelDia: Number(p.hour) * 60 + Number(p.minute),
    diaSemana: DIAS[p.weekday],
  };
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function esFechaValida(fecha: string): boolean {
  const m = FECHA.exec(fecha);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

export function esHoraValida(hora: string): boolean {
  return HORA.test(hora);
}

/**
 * Instante UTC de una fecha y hora locales de Santiago. Devuelve `null` si esa hora no existe
 * (salto del cambio de horario). Si se repite (fin del horario de verano), toma la primera.
 */
export function instanteLocal(fecha: string, hora: string): Date | null {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const comoUtc = Date.UTC(anio, mes - 1, dia, h, min);
  // Los desfases posibles de Santiago son -3 y -4 horas: se prueban ambos y se conserva el que
  // reproduce la hora pedida. Probar -3 primero elige la primera ocurrencia (la más temprana en UTC)
  // de una hora repetida.
  for (const desfaseHoras of [3, 4]) {
    const candidato = new Date(comoUtc + desfaseHoras * 3_600_000);
    const partes = partesLocales(candidato);
    if (partes.fecha === fecha && partes.hora === hora) {
      return candidato;
    }
  }
  return null;
}
