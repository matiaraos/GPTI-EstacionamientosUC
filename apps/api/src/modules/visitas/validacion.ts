import { z } from "zod";
import { HttpError, type ErrorDetails } from "../../lib/errors.js";
import type { Database } from "../../lib/prisma.js";
import { esFechaValida, esHoraValida, instanteLocal, partesLocales } from "../../lib/tiempo.js";

/** Datos de una visita tal como los ingresa la persona: fecha y horas locales de Santiago. */
export const visitaSchema = z.object({
  fecha: z.string({ error: "Elige la fecha de tu visita." }).refine(esFechaValida, "Ingresa una fecha válida (AAAA-MM-DD)."),
  llegada: z.string({ error: "Indica tu hora de llegada." }).refine(esHoraValida, "Ingresa una hora válida (HH:MM)."),
  salida: z.string({ error: "Indica tu hora de salida." }).refine(esHoraValida, "Ingresa una hora válida (HH:MM)."),
  /** Destino declarado. Solo se usa si la persona no tiene clases durante la visita (04B). */
  destinoId: z.preprocess(
    (valor) => (valor === null || valor === "" ? undefined : valor),
    z.coerce
      .number({ error: "Elige una sala o un edificio de destino." })
      .int("Elige una sala o un edificio de destino.")
      .positive("Elige una sala o un edificio de destino.")
      .optional(),
  ),
});

export type DatosVisita = z.output<typeof visitaSchema>;

export type VisitaValidada = {
  fecha: string;
  llegada: string;
  salida: string;
  /** Intervalo `[inicio, fin)` en UTC. */
  inicio: Date;
  fin: Date;
  destino: DestinoVisita;
  /** Destino de la última clase de la visita, para desempatar bloques; nulo sin clases. */
  destinoDesempate: DestinoVisita | null;
  /** `horario` si el destino es el de la primera clase; `declarado` si lo eligió la persona. */
  origenDestino: "horario" | "declarado";
  /** Clases del horario que caen dentro de la visita, en orden. */
  clases: { inicio: string; fin: string; titulo: string | null; destino: DestinoVisita }[];
};

type DestinoVisita = { id: number; idOrigen: string; nombre: string; tipo: "sala" | "edificio" };

const selectDestino = { id: true, idOrigen: true, nombre: true, tipo: true } as const;
const hhmm = (minuto: number) => `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

const invalida = (details: ErrorDetails) => new HttpError(400, "datos_invalidos", "Revisa los datos de tu visita.", details);

/**
 * Convierte la visita a instantes UTC y resuelve el destino: si la persona tiene clases durante la
 * visita, el de la primera clase (y el de la última para desempatar); si no, el destino declarado.
 * Reúne todos los errores por campo en una sola respuesta.
 */
export async function validarVisita(db: Database, datos: DatosVisita, cuentaId?: number): Promise<VisitaValidada> {
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

  const clases =
    cuentaId && inicio && fin && !details.salida
      ? await db.bloqueClase.findMany({
          where: {
            cuentaId,
            diaSemana: partesLocales(inicio).diaSemana,
            inicioMinuto: { lt: minutos(datos.salida) },
            finMinuto: { gt: minutos(datos.llegada) },
            destino: { activo: true },
          },
          orderBy: { inicioMinuto: "asc" },
          select: { inicioMinuto: true, finMinuto: true, titulo: true, destino: { select: selectDestino } },
        })
      : [];

  let destino: DestinoVisita | null = null;
  let destinoDesempate: DestinoVisita | null = null;
  if (clases.length > 0) {
    destino = clases[0].destino;
    destinoDesempate = clases[clases.length - 1].destino;
  } else if (!datos.destinoId) {
    details.destinoId = "Elige una sala o un edificio de destino. No tienes clases registradas en ese horario.";
  } else {
    destino = await db.destino.findFirst({ where: { id: datos.destinoId, activo: true }, select: selectDestino });
    if (!destino) {
      details.destinoId = "El destino elegido no existe en el catálogo. Búscalo de nuevo.";
    }
  }

  if (Object.keys(details).length > 0 || !inicio || !fin || !destino) {
    throw invalida(details);
  }
  return {
    fecha: datos.fecha,
    llegada: datos.llegada,
    salida: datos.salida,
    inicio,
    fin,
    destino,
    destinoDesempate,
    origenDestino: clases.length > 0 ? "horario" : "declarado",
    clases: clases.map((c) => ({ inicio: hhmm(c.inicioMinuto), fin: hhmm(c.finMinuto), titulo: c.titulo, destino: c.destino })),
  };
}
