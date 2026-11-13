import type { Database } from "../../lib/prisma.js";
import { partesLocales } from "../../lib/tiempo.js";
import { calcularIndicadores, type Modo } from "./indicadores.js";

export type ResultadoCierre = { resultados: { modo: Modo; desde: string; hasta: string }[]; eliminados: Record<string, number> };

/**
 * Cierre del piloto (08B). Guarda los indicadores agregados de todo el período y luego elimina los
 * datos identificables: cuentas de usuario, todas las patentes, sesiones, horarios, reservas, eventos, avisos,
 * encuestas, incidentes, series y esperas. Conserva el catálogo, el inventario, las cuentas de
 * administración y los resultados anónimos. Todo ocurre en una transacción.
 */
export async function cerrarPiloto(db: Database, ahora: Date): Promise<ResultadoCierre> {
  const rango = await db.reserva.aggregate({ _min: { inicio: true }, _max: { inicio: true } });
  const resultados: ResultadoCierre["resultados"] = [];
  if (rango._min.inicio && rango._max.inicio) {
    const desde = partesLocales(rango._min.inicio).fecha;
    const hasta = partesLocales(rango._max.inicio).fecha;
    for (const modo of ["real", "simulacion"] as const) {
      const reporte = await calcularIndicadores(db, desde, hasta, modo);
      if (reporte.indicadores.find((i) => i.clave === "asignaciones_con_horario")?.denominador) {
        await db.resultadoPiloto.create({
          data: { desde: new Date(`${desde}T00:00:00Z`), hasta: new Date(`${hasta}T00:00:00Z`), modo, generadoEn: ahora, indicadores: reporte.indicadores },
        });
        resultados.push({ modo, desde, hasta });
      }
    }
  }

  const eliminados: Record<string, number> = {};
  await db.$transaction(async (tx) => {
    const usuarios = { rol: "usuario" as const };
    const borrar = async (nombre: string, operacion: Promise<{ count: number }>) => {
      eliminados[nombre] = (await operacion).count;
    };
    await borrar("avisos", tx.aviso.deleteMany());
    await borrar("canalesAviso", tx.canalAviso.deleteMany());
    await borrar("lecturasQR", tx.lecturaQR.deleteMany());
    await borrar("encuestas", tx.encuestaSatisfaccion.deleteMany());
    await borrar("eventos", tx.eventoReserva.deleteMany());
    await borrar("ajustesRanking", tx.ajusteRanking.deleteMany());
    await tx.bloqueoPlaza.updateMany({ where: { incidenteId: { not: null } }, data: { incidenteId: null } });
    await borrar("incidentes", tx.incidente.deleteMany());
    await borrar("esperas", tx.solicitudEspera.deleteMany());
    await tx.reserva.updateMany({ data: { reemplazaId: null } });
    await borrar("reservas", tx.reserva.deleteMany());
    await borrar("series", tx.serieReserva.deleteMany());
    await borrar("conexionesUC", tx.conexionUC.deleteMany());
    await borrar("bloquesClase", tx.bloqueClase.deleteMany());
    await borrar("autorizaciones", tx.autorizacionPreferente.deleteMany());
    await borrar("recuperaciones", tx.recuperacion.deleteMany());
    await borrar("sesiones", tx.sesion.deleteMany({ where: { cuenta: usuarios } }));
    // Las patentes son identificables también en cuentas de administración.
    await borrar("vehiculos", tx.vehiculo.deleteMany());
    await borrar("cuentas", tx.cuenta.deleteMany({ where: usuarios }));
  }, { timeout: 60_000 });
  return { resultados, eliminados };
}
