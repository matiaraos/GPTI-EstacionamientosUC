import { z } from "zod";
import { HttpError, type ErrorDetails } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esFechaValida, esHoraValida, instanteLocal } from "../../lib/tiempo.js";

/** Datos de una visita tal como los ingresa la persona: fecha y horas locales de Santiago. */
export const visitaSchema = z.object({
  fecha: z.string({ error: "Elige la fecha de tu visita." }).refine(esFechaValida, "Ingresa una fecha válida (AAAA-MM-DD)."),
  llegada: z.string({ error: "Indica tu hora de llegada." }).refine(esHoraValida, "Ingresa una hora válida (HH:MM)."),
  salida: z.string({ error: "Indica tu hora de salida." }).refine(esHoraValida, "Ingresa una hora válida (HH:MM)."),
  destinoId: z.coerce
    .number({ error: "Elige una sala o un edificio de destino." })
    .int("Elige una sala o un edificio de destino.")
    .positive("Elige una sala o un edificio de destino."),
});

export type DatosVisita = z.output<typeof visitaSchema>;

export type VisitaValidada = {
  fecha: string;
  llegada: string;
  salida: string;
  /** Intervalo `[inicio, fin)` en UTC. */
  inicio: Date;
  fin: Date;
  destino: { id: number; idOrigen: string; nombre: string; tipo: "sala" | "edificio" };
};

const invalida = (details: ErrorDetails) => new HttpError(400, "datos_invalidos", "Revisa los datos de tu visita.", details);

/**
 * Convierte la visita a instantes UTC y comprueba que el destino exista y que la salida sea
 * posterior a la llegada. Reúne todos los errores por campo en una sola respuesta.
 */
export async function validarVisita(db: Database, datos: DatosVisita): Promise<VisitaValidada> {
  const details: ErrorDetails = {};
  const inicio = instanteLocal(datos.fecha, datos.llegada);
  const fin = instanteLocal(datos.fecha, datos.salida);
  if (!inicio) {
    details.llegada = "Esa hora no existe ese día por el cambio de horario.";
  }
  if (!fin) {
    details.salida = "Esa hora no existe ese día por el cambio de horario.";
  }
  if (inicio && fin && fin <= inicio) {
    details.salida = "La salida debe ser posterior a la llegada.";
  }

  const destino = await db.destino.findFirst({
    where: { id: datos.destinoId, activo: true },
    select: { id: true, idOrigen: true, nombre: true, tipo: true },
  });
  if (!destino) {
    details.destinoId = "El destino elegido no existe en el catálogo. Búscalo de nuevo.";
  }

  if (Object.keys(details).length > 0 || !inicio || !fin || !destino) {
    throw invalida(details);
  }
  return { fecha: datos.fecha, llegada: datos.llegada, salida: datos.salida, inicio, fin, destino };
}
