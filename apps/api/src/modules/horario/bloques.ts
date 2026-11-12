import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError, type ErrorDetails } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";

type Cliente = Database | Prisma.TransactionClient;

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;
export const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
export const aHora = (minuto: number) =>
  `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;

export const bloqueSchema = z
  .object({
    diaSemana: z.number({ error: "Elige el día." }).int().min(1, "Elige el día.").max(7, "Elige el día."),
    inicio: z.string({ error: "Indica la hora de inicio." }).regex(HORA, "Usa el formato HH:MM."),
    fin: z.string({ error: "Indica la hora de término." }).regex(HORA, "Usa el formato HH:MM."),
    destinoId: z
      .number({ error: "Elige la sala o el edificio de la clase." })
      .int("Elige la sala o el edificio de la clase.")
      .positive("Elige la sala o el edificio de la clase."),
    titulo: z.string().trim().max(120).nullish(),
  })
  .refine((b) => aMinutos(b.fin) > aMinutos(b.inicio), { message: "El término debe ser posterior al inicio.", path: ["fin"] });

export type DatosBloque = z.output<typeof bloqueSchema>;

export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/**
 * Comprueba destinos y solapes de una lista de bloques. Devuelve los errores por campo con el prefijo
 * indicado (por ejemplo, `bloques.2.fin`). `otros` son bloques ya guardados que deben respetarse.
 */
export async function erroresDeBloques(
  db: Cliente,
  bloques: DatosBloque[],
  prefijo: (i: number) => string,
  otros: { id: number; diaSemana: number; inicioMinuto: number; finMinuto: number }[] = [],
): Promise<ErrorDetails> {
  const details: ErrorDetails = {};
  const ids = [...new Set(bloques.map((b) => b.destinoId))];
  const existentes = new Set(
    (await db.destino.findMany({ where: { id: { in: ids }, activo: true }, select: { id: true } })).map((d) => d.id),
  );
  const tramos = bloques.map((b) => ({ dia: b.diaSemana, inicio: aMinutos(b.inicio), fin: aMinutos(b.fin) }));
  bloques.forEach((b, i) => {
    if (!existentes.has(b.destinoId)) {
      details[`${prefijo(i)}destinoId`] = "El destino no existe en el catálogo. Búscalo de nuevo.";
    }
    const t = tramos[i];
    const choca =
      tramos.some((o, j) => j !== i && o.dia === t.dia && o.inicio < t.fin && t.inicio < o.fin) ||
      otros.some((o) => o.diaSemana === t.dia && o.inicioMinuto < t.fin && t.inicio < o.finMinuto);
    if (choca) {
      details[`${prefijo(i)}inicio`] = `Se superpone con otro bloque del ${DIAS[t.dia - 1]}.`;
    }
  });
  return details;
}

export const incluirBloque = { destino: { select: { id: true, idOrigen: true, nombre: true, tipo: true, pisos: true } } } as const;

type BloqueConDestino = Prisma.BloqueClaseGetPayload<{ include: typeof incluirBloque }>;

export function bloquePublico(b: BloqueConDestino) {
  return { id: b.id, diaSemana: b.diaSemana, inicio: aHora(b.inicioMinuto), fin: aHora(b.finMinuto), titulo: b.titulo, destino: b.destino };
}

export const datosFila = (cuentaId: number, b: DatosBloque) => ({
  cuentaId,
  destinoId: b.destinoId,
  diaSemana: b.diaSemana,
  inicioMinuto: aMinutos(b.inicio),
  finMinuto: aMinutos(b.fin),
  titulo: b.titulo ?? null,
});

export const horarioInvalido = (details: ErrorDetails) =>
  new HttpError(400, "datos_invalidos", "Revisa los bloques del horario. Tu horario anterior no cambió.", details);
