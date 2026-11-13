import type { Prisma, TipoAviso } from "../../generated/prisma/client.js";
import { instanteLocal, partesLocales } from "../../lib/tiempo.js";

type Tx = Prisma.TransactionClient;

type ReservaAviso = {
  id: number;
  cuentaId: number;
  inicio: Date;
  fin: Date;
  plaza: { codigo: string; zona: { nombre: string } };
};

const fechaLarga = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long" });

/** «lunes 16 de noviembre, 09:00–12:00». */
export function horarioDe(reserva: { inicio: Date; fin: Date }) {
  return `${fechaLarga.format(reserva.inicio)}, ${partesLocales(reserva.inicio).hora}–${partesLocales(reserva.fin).hora}`;
}

const plazaDe = (r: ReservaAviso) => `plaza ${r.plaza.codigo} en ${r.plaza.zona.nombre}`;

/** Registra un aviso una sola vez. Se llama dentro de la transacción que produce el resultado. */
export async function registrarAviso(
  tx: Tx,
  datos: { cuentaId: number; reservaId?: number | null; tipo: TipoAviso; clave: string; titulo: string; cuerpo: string; ahora: Date; programadoEn?: Date },
) {
  await tx.aviso.createMany({
    data: [
      {
        cuentaId: datos.cuentaId,
        reservaId: datos.reservaId ?? null,
        tipo: datos.tipo,
        claveDeduplicacion: datos.clave,
        titulo: datos.titulo,
        cuerpo: datos.cuerpo,
        creadoEn: datos.ahora,
        programadoEn: datos.programadoEn ?? datos.ahora,
      },
    ],
    skipDuplicates: true,
  });
}

/** Aviso del resultado de una asignación: confirmación, cambio o plaza obtenida desde la espera. */
export async function avisarAsignacion(tx: Tx, reserva: ReservaAviso, origen: "solicitud" | "cambio" | "espera" | "serie", ahora: Date) {
  const tipo: TipoAviso = origen === "cambio" ? "cambio" : origen === "espera" ? "espera_asignada" : "confirmacion";
  const titulo = origen === "serie" ? "Reserva semanal confirmada" : { confirmacion: "Reserva confirmada", cambio: "Cambio de reserva confirmado", espera_asignada: "Se liberó una plaza para ti" }[
    tipo as "confirmacion" | "cambio" | "espera_asignada"
  ];
  await registrarAviso(tx, {
    cuentaId: reserva.cuentaId,
    reservaId: reserva.id,
    tipo,
    clave: `${tipo}:reserva:${reserva.id}`,
    titulo,
    cuerpo: `${horarioDe(reserva)}, ${plazaDe(reserva)}.${origen === "cambio" ? " Tu reserva anterior quedó cancelada." : ""} Al llegar, escanea el QR de la plaza.`,
    ahora,
  });
  await programarRecordatorios(tx, reserva, ahora);
}

export async function avisarCancelacion(tx: Tx, reserva: ReservaAviso, ahora: Date, motivo?: string) {
  await registrarAviso(tx, {
    cuentaId: reserva.cuentaId,
    reservaId: reserva.id,
    tipo: "cancelacion",
    clave: `cancelacion:reserva:${reserva.id}`,
    titulo: "Reserva cancelada",
    cuerpo: motivo
      ? `Se canceló tu reserva del ${horarioDe(reserva)} (${plazaDe(reserva)}): ${motivo}`
      : `Cancelaste la reserva del ${horarioDe(reserva)} (${plazaDe(reserva)}). La plaza quedó libre.`,
    ahora,
  });
  await cancelarRecordatorios(tx, reserva.id, ahora);
}

/** Falta de disponibilidad. La clave usa la de la solicitud para no repetirlo en un reintento. */
export async function avisarSinCupo(tx: Tx, datos: { cuentaId: number; claveSolicitud: string; inicio: Date; fin: Date; ahora: Date }) {
  await registrarAviso(tx, {
    cuentaId: datos.cuentaId,
    tipo: "sin_cupo",
    clave: `sin_cupo:${datos.cuentaId}:${datos.claveSolicitud}`,
    titulo: "Sin plazas disponibles",
    cuerpo: `No hubo plazas para el ${horarioDe(datos)}. Puedes unirte a la lista de espera o probar otro horario.`,
    ahora: datos.ahora,
  });
}

/**
 * Recordatorios al terminar la última clase de la visita y a la hora de salida declarada. Si coinciden
 * (o no hay clases), se programa uno solo. No se programan recordatorios para instantes pasados.
 */
export async function programarRecordatorios(tx: Tx, reserva: ReservaAviso, ahora: Date) {
  const { fecha, diaSemana } = partesLocales(reserva.inicio);
  const minuto = (d: Date) => partesLocales(d).minutoDelDia;
  const ultima = await tx.bloqueClase.findFirst({
    where: { cuentaId: reserva.cuentaId, diaSemana, inicioMinuto: { lt: minuto(reserva.fin) }, finMinuto: { gt: minuto(reserva.inicio), lt: minuto(reserva.fin) } },
    orderBy: { finMinuto: "desc" },
    include: { destino: { select: { nombre: true } } },
  });
  if (ultima) {
    const hh = `${String(Math.floor(ultima.finMinuto / 60)).padStart(2, "0")}:${String(ultima.finMinuto % 60).padStart(2, "0")}`;
    const fin = instanteLocal(fecha, hh);
    if (fin && fin > ahora) {
      await registrarAviso(tx, {
        cuentaId: reserva.cuentaId,
        reservaId: reserva.id,
        tipo: "recordatorio_clase",
        clave: `recordatorio_clase:reserva:${reserva.id}`,
        titulo: "Terminó tu última clase",
        cuerpo: `Tu reserva en la ${plazaDe(reserva)} termina a las ${partesLocales(reserva.fin).hora}. Al salir, escanea el QR para registrar tu salida.`,
        ahora,
        programadoEn: fin,
      });
    }
  }
  if (reserva.fin > ahora) {
    await registrarAviso(tx, {
      cuentaId: reserva.cuentaId,
      reservaId: reserva.id,
      tipo: "recordatorio_salida",
      clave: `recordatorio_salida:reserva:${reserva.id}`,
      titulo: "Llegó tu hora de salida",
      cuerpo: `Registra tu salida escaneando el QR de la ${plazaDe(reserva)} para liberarla y mantener tu puntaje.`,
      ahora,
      programadoEn: reserva.fin,
    });
  }
}

/** Cancela los recordatorios pendientes de una reserva (al cancelarla, cambiarla, vencer o salir). */
export async function cancelarRecordatorios(tx: Tx, reservaId: number, ahora: Date) {
  await tx.aviso.updateMany({
    where: { reservaId, estado: "pendiente", tipo: { in: ["recordatorio_clase", "recordatorio_salida"] } },
    data: { estado: "cancelado", ultimoError: null, enviadoEn: null, programadoEn: ahora },
  });
}
