import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { mainDatabaseUrl, testDatabaseUrl } from "./db.js";

const apiDir = fileURLToPath(new URL("../..", import.meta.url));

/** Crea la base de pruebas si no existe y le aplica las migraciones. */
export default async function globalSetup() {
  const testUrl = testDatabaseUrl();
  const name = new URL(testUrl).pathname.replace(/^\//, "");

  const client = new pg.Client({ connectionString: mainDatabaseUrl() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      "No se pudo conectar a PostgreSQL. Ejecuta `docker compose up -d --wait db` desde la raíz del repo.",
      { cause: error },
    );
  }
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }

  execFileSync("npx", ["--no-install", "prisma", "migrate", "deploy"], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
    stdio: "pipe",
  });
}
