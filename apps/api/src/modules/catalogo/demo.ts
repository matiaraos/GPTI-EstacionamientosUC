import type { Database } from "../../lib/prisma.js";
import { contenidoQr, nuevoIdentificadorQr } from "./qr.js";

/**
 * Plazas ficticias para la demo. Son los dos bloques más cercanos a ED113 por la red peatonal
 * (PARKING-7 a 240 m y PARKING-5 a 257 m), para mostrar el cambio de bloque cuando se llena el primero.
 * El inventario real del piloto sigue pendiente (spec 02B).
 */
export const BLOQUES_DEMO = [
  { bloque: "PARKING-7", codigos: ["A1", "A2"] },
  { bloque: "PARKING-5", codigos: ["B1", "B2", "B3"] },
] as const;

const h = (horas: number, minutos = 0) => horas * 60 + minutos;

/** Lunes a viernes de 07:00 a 22:00 y sábado de 08:00 a 14:00, hora de Santiago. */
export const HORARIOS_DEMO = [
  ...[1, 2, 3, 4, 5].map((diaSemana) => ({ diaSemana, abreMinuto: h(7), cierraMinuto: h(22) })),
  { diaSemana: 6, abreMinuto: h(8), cierraMinuto: h(14) },
];

export type PlazaDemo = { bloque: string; zona: string; codigo: string; qr: string };

/** Crea o completa las plazas, horarios y QR de la demo. Requiere el catálogo cargado. Es idempotente. */
export async function sembrarPlazasDemo(db: Database): Promise<PlazaDemo[]> {
  const resultado: PlazaDemo[] = [];
  for (const { bloque, codigos } of BLOQUES_DEMO) {
    const zona = await db.zona.findUnique({ where: { idOrigen: bloque } });
    if (!zona) {
      throw new Error(`Falta el bloque ${bloque}. Importa el catálogo antes de crear las plazas de demo.`);
    }
    for (const horario of HORARIOS_DEMO) {
      await db.horarioZona.upsert({
        where: { zonaId_diaSemana: { zonaId: zona.id, diaSemana: horario.diaSemana } },
        create: { zonaId: zona.id, ...horario },
        update: horario,
      });
    }
    for (const codigo of codigos) {
      const plaza = await db.plaza.upsert({
        where: { zonaId_codigo: { zonaId: zona.id, codigo } },
        create: { zonaId: zona.id, codigo, tipo: "regular" },
        update: {},
      });
      const vigente =
        (await db.qrPlaza.findFirst({ where: { plazaId: plaza.id, revocadoEn: null } })) ??
        (await db.qrPlaza.create({ data: { plazaId: plaza.id, identificador: nuevoIdentificadorQr() } }));
      resultado.push({ bloque, zona: zona.nombre, codigo, qr: contenidoQr(vigente.identificador) });
    }
  }
  return resultado;
}
