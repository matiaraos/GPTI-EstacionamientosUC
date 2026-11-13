import type { Mailer } from "../../lib/correo.js";
import type { Database } from "../../lib/prisma.js";

export type ResultadoPush = { ok: boolean; tokensInvalidos: string[]; error?: string };

/** Envío de notificaciones de la app. En producción usa Expo Push; en pruebas se reemplaza. */
export type Notificador = {
  push: (tokens: string[], mensaje: { titulo: string; cuerpo: string; datos: Record<string, unknown> }) => Promise<ResultadoPush>;
};

/** Expo Push API. Un token `DeviceNotRegistered` se desactiva para no volver a usarlo. */
export function crearNotificadorExpo(accessToken: string | null): Notificador {
  return {
    async push(tokens, { titulo, cuerpo, datos }) {
      const respuesta = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify(tokens.map((to) => ({ to, title: titulo, body: cuerpo, data: datos, sound: "default" }))),
        signal: AbortSignal.timeout(10_000),
      });
      if (!respuesta.ok) return { ok: false, tokensInvalidos: [], error: `Expo Push respondió ${respuesta.status}` };
      const { data } = (await respuesta.json()) as { data: { status: string; details?: { error?: string } }[] };
      const tokensInvalidos = tokens.filter((_, i) => data[i]?.details?.error === "DeviceNotRegistered");
      const algunoOk = data.some((ticket) => ticket.status === "ok");
      return { ok: algunoOk, tokensInvalidos, error: algunoOk ? undefined : (data[0]?.details?.error ?? "Expo Push rechazó el envío") };
    },
  };
}

export type ResultadoEnvio = { enviados: number[]; reintentos: number[]; fallidos: number[]; cancelados: number[] };

const MAX_INTENTOS = 3;

/**
 * Envía los avisos vencidos: notificación de la app si la persona registró un dispositivo y, si no hay
 * o falla, correo institucional. Un envío fallido se reintenta con espera creciente hasta tres veces
 * y nunca modifica la reserva. Un recordatorio cuya reserva ya no está activa se cancela sin enviarse.
 */
export async function procesarAvisos(db: Database, ahora: Date, deps: { notificador: Notificador; mailer: Mailer }): Promise<ResultadoEnvio> {
  const resultado: ResultadoEnvio = { enviados: [], reintentos: [], fallidos: [], cancelados: [] };
  const pendientes = await db.aviso.findMany({
    where: { estado: "pendiente", programadoEn: { lte: ahora } },
    orderBy: [{ programadoEn: "asc" }, { id: "asc" }],
    take: 100,
    include: { cuenta: { select: { correo: true } }, reserva: { select: { estado: true } } },
  });
  for (const aviso of pendientes) {
    // Tomar el aviso con una condición sobre el estado evita enviarlo dos veces en procesos simultáneos.
    const { count } = await db.aviso.updateMany({ where: { id: aviso.id, estado: "pendiente" }, data: { estado: "enviando" } });
    if (count === 0) continue;
    const esRecordatorio = aviso.tipo === "recordatorio_clase" || aviso.tipo === "recordatorio_salida";
    if (esRecordatorio && !["confirmada", "en_uso"].includes(aviso.reserva?.estado ?? "")) {
      await db.aviso.update({ where: { id: aviso.id }, data: { estado: "cancelado" } });
      resultado.cancelados.push(aviso.id);
      continue;
    }
    const errores: string[] = [];
    let canal: "push" | "correo" | null = null;
    try {
      const canales = await db.canalAviso.findMany({ where: { cuentaId: aviso.cuentaId, activo: true }, select: { token: true } });
      if (canales.length > 0) {
        const push = await deps.notificador
          .push(
            canales.map((c) => c.token),
            { titulo: aviso.titulo, cuerpo: aviso.cuerpo, datos: { avisoId: aviso.id, reservaId: aviso.reservaId, tipo: aviso.tipo } },
          )
          .catch((error: unknown) => ({ ok: false, tokensInvalidos: [], error: String((error as Error)?.message ?? error) }));
        if (push.tokensInvalidos.length) {
          await db.canalAviso.updateMany({ where: { token: { in: push.tokensInvalidos } }, data: { activo: false } });
        }
        if (push.ok) canal = "push";
        else errores.push(`push: ${push.error}`);
      }
      if (!canal) {
        await deps.mailer.enviar({ para: aviso.cuenta.correo, asunto: `MiEstacionamientoUC · ${aviso.titulo}`, texto: aviso.cuerpo });
        canal = "correo";
      }
    } catch (error) {
      errores.push(`correo: ${String((error as Error)?.message ?? error)}`);
    }
    const intentos = aviso.intentos + 1;
    if (canal) {
      await db.aviso.update({ where: { id: aviso.id }, data: { estado: "enviado", canal, enviadoEn: ahora, intentos, ultimoError: errores.join("; ") || null } });
      resultado.enviados.push(aviso.id);
    } else {
      const agotado = intentos >= MAX_INTENTOS;
      await db.aviso.update({
        where: { id: aviso.id },
        data: {
          estado: agotado ? "fallido" : "pendiente",
          intentos,
          ultimoError: errores.join("; "),
          programadoEn: agotado ? aviso.programadoEn : new Date(ahora.getTime() + intentos * 60_000),
        },
      });
      (agotado ? resultado.fallidos : resultado.reintentos).push(aviso.id);
    }
  }
  return resultado;
}

/** Ejecuta el envío periódicamente dentro del proceso de la API. */
export function programarAvisos(db: Database, deps: { notificador: Notificador; mailer: Mailer }, intervaloS: number): () => void {
  if (intervaloS <= 0) return () => undefined;
  let enCurso = false;
  const timer = setInterval(async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      await procesarAvisos(db, new Date(), deps);
    } catch (error) {
      console.error("No se pudieron enviar los avisos.", error);
    } finally {
      enCurso = false;
    }
  }, intervaloS * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
