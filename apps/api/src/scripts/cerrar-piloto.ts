import "dotenv/config";
import { loadConfig } from "../config.js";
import { createDatabase } from "../lib/prisma.js";
import { cerrarPiloto } from "../modules/piloto/cierre.js";

/**
 * Cierre del piloto: guarda los indicadores agregados y elimina los datos identificables.
 * Irreversible. Uso: npm run piloto:cerrar -w @miestacionamientouc/api -- --confirmar
 */
if (!process.argv.includes("--confirmar")) {
  console.error("El cierre elimina cuentas, patentes, reservas y demás datos personales. Repite con --confirmar.");
  process.exit(1);
}
const config = loadConfig();
const db = createDatabase(config.databaseUrl, { statementTimeoutMs: 60_000 });
try {
  const resultado = await cerrarPiloto(db, new Date());
  console.log("Resultados guardados:", resultado.resultados);
  console.log("Registros eliminados:", resultado.eliminados);
} finally {
  await db.$disconnect();
}
