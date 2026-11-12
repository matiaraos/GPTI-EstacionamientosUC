import "dotenv/config";
import { loadConfig } from "../config.js";
import { createDatabase } from "../lib/prisma.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../modules/catalogo/importar.js";

/** Carga o actualiza el catálogo de San Joaquín. Se puede repetir sin duplicar registros. */
const db = createDatabase(loadConfig().databaseUrl);
try {
  const resumen = await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
  console.log(`Catálogo importado: ${resumen.zonas} bloques, ${resumen.destinos} destinos, ${resumen.cercanias} distancias.`);
} finally {
  await db.$disconnect();
}
