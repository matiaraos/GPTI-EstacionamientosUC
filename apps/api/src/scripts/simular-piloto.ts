import "dotenv/config";
import { parseArgs } from "node:util";
import { loadConfig } from "../config.js";
import { createDatabase } from "../lib/prisma.js";
import { calcularIndicadores } from "../modules/piloto/indicadores.js";
import { simularPiloto } from "../modules/piloto/simulacion.js";

/**
 * Genera una simulación del piloto con cuentas ficticias (`simulada`).
 * Uso: npm run piloto:simular -w @miestacionamientouc/api -- --desde 2026-11-16 --dias 5 --usuarios 60
 */
const { values } = parseArgs({
  options: { desde: { type: "string" }, dias: { type: "string", default: "5" }, usuarios: { type: "string", default: "60" }, semilla: { type: "string", default: "2026" } },
});
if (!values.desde) throw new Error("Indica --desde AAAA-MM-DD (un lunes).");
const config = loadConfig();
const db = createDatabase(config.databaseUrl, { statementTimeoutMs: 30_000 });
try {
  const resumen = await simularPiloto(db, {
    desde: values.desde,
    dias: Number(values.dias),
    usuarios: Number(values.usuarios),
    semilla: Number(values.semilla),
    dominio: config.auth.allowedEmailDomains[0],
    reservas: { ...config.reservas, simultaneidadMs: 0 },
    ranking: config.ranking,
  });
  console.log("Simulación:", resumen);
  const hasta = new Date(Date.parse(`${values.desde}T00:00:00Z`) + (Number(values.dias) - 1) * 86_400_000).toISOString().slice(0, 10);
  const reporte = await calcularIndicadores(db, values.desde, hasta, "simulacion");
  for (const i of reporte.indicadores) console.log(`  ${i.nombre}: ${i.valor ?? "—"}${i.unidad === "%" ? " %" : ""} (${i.meta}) ${i.cumple ? "✓" : "✗"}`);
  console.log(reporte.nota);
} finally {
  await db.$disconnect();
}
