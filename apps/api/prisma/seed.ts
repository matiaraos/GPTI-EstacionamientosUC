import "dotenv/config";
import bcrypt from "bcrypt";
import { loadConfig } from "../src/config.js";
import { createDatabase } from "../src/lib/prisma.js";
import { sembrarPlazasDemo } from "../src/modules/catalogo/demo.js";
import { directorioCatalogo, importarCatalogo, leerFuentesCatalogo } from "../src/modules/catalogo/importar.js";
import { dominioDeCorreo, normalizarCorreo } from "../src/modules/cuentas/normalizacion.js";

/**
 * Prepara el entorno local: administrador de prueba, catálogo de San Joaquín y plazas de demo.
 * No usar con cuentas reales: el procedimiento para habilitar administradores del piloto sigue
 * pendiente (spec 01A) y las plazas son ficticias (spec 02A).
 */
async function main() {
  const config = loadConfig();
  const correo = normalizarCorreo(process.env.ADMIN_SEED_EMAIL ?? "");
  const contrasena = process.env.ADMIN_SEED_PASSWORD ?? "";
  if (!correo || contrasena.length < 8) {
    throw new Error("Configura ADMIN_SEED_EMAIL y ADMIN_SEED_PASSWORD (mínimo 8 caracteres) en apps/api/.env.");
  }
  if (!config.auth.allowedEmailDomains.includes(dominioDeCorreo(correo))) {
    throw new Error(`ADMIN_SEED_EMAIL debe usar un dominio de ALLOWED_EMAIL_DOMAINS (${config.auth.allowedEmailDomains.join(", ")}).`);
  }

  const db = createDatabase(config.databaseUrl, { statementTimeoutMs: 30_000 });
  try {
    const hashContrasena = await bcrypt.hash(contrasena, config.auth.bcryptRounds);
    await db.cuenta.upsert({
      where: { correo },
      create: { correo, hashContrasena, rol: "admin" },
      update: { hashContrasena, rol: "admin", activa: true },
    });
    console.log(`Administrador de prueba listo: ${correo}`);

    const resumen = await importarCatalogo(db, await leerFuentesCatalogo(directorioCatalogo));
    console.log(`Catálogo: ${resumen.zonas} bloques, ${resumen.destinos} destinos, ${resumen.cercanias} distancias.`);
    console.log("Plazas de demo (contenido de cada QR):");
    for (const plaza of await sembrarPlazasDemo(db)) {
      console.log(`  ${plaza.zona} · ${plaza.codigo} → ${plaza.qr}`);
    }
  } finally {
    await db.$disconnect();
  }
}

await main();
