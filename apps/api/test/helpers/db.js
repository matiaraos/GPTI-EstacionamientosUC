import "dotenv/config";
import { createDatabase } from "../../dist/lib/prisma.js";

const defaultUrl = "postgresql://estacionamientos:estacionamientos_dev@127.0.0.1:5433/estacionamientos";

export function mainDatabaseUrl() {
  return process.env.DATABASE_URL || defaultUrl;
}

/** Base separada para las pruebas, para no tocar los datos de desarrollo. */
export function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  const url = new URL(mainDatabaseUrl());
  url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  return url.toString();
}

export function createTestDatabase() {
  return createDatabase(testDatabaseUrl(), { statementTimeoutMs: 30_000 });
}

/** Vacía todas las tablas del esquema público salvo el historial de migraciones. */
export async function resetDatabase(db) {
  const tables = await db.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) {
    return;
  }
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
