/**
 * Las fechas y horas de una visita son horas de pared de Santiago, como "2026-11-16" y "08:15".
 * La API las convierte a instantes; la app solo las muestra y las edita como texto.
 */
export const ZONA_HORARIA = "America/Santiago";

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha y hora actuales en Santiago, sin depender de la zona horaria del teléfono. */
export function ahoraEnSantiago(ahora = new Date()): { fecha: string; hora: string } {
  try {
    const partes = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: ZONA_HORARIA,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(ahora)
        .map((parte) => [parte.type, parte.value]),
    );
    return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
  } catch {
    return { fecha: fechaDeDate(ahora), hora: horaDeDate(ahora) };
  }
}

/** Los selectores nativos trabajan con `Date` local: se usa solo como contenedor de la hora de pared. */
export function dateDesdeTexto(fecha: string, hora = "12:00"): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(anio, mes - 1, dia, h, m);
}

export function fechaDeDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function horaDeDate(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Siguiente cuarto de hora, para proponer la llegada. */
export function proximoCuartoDeHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const total = Math.min(Math.ceil((h * 60 + m + 1) / 15) * 15, 23 * 60 + 45);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function sumarHoras(hora: string, horas: number, tope = "23:59"): string {
  const [h, m] = hora.split(":").map(Number);
  const [th, tm] = tope.split(":").map(Number);
  const total = Math.min(h * 60 + m + horas * 60, th * 60 + tm);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const formatoFecha = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" });

/** "lunes 16 de noviembre". */
export function fechaLegible(fecha: string): string {
  try {
    return formatoFecha.format(dateDesdeTexto(fecha));
  } catch {
    return fecha;
  }
}
