import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export type Database = PrismaClient;

type Options = {
  /**
   * Límite por instrucción. La API usa 2,5 s para responder rápido si la base no está disponible;
   * los scripts de carga y las pruebas usan un límite mayor.
   */
  statementTimeoutMs?: number;
};

export function createDatabase(connectionString: string, { statementTimeoutMs = 2500 }: Options = {}): Database {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 2500,
    statement_timeout: statementTimeoutMs,
  });
  return new PrismaClient({ adapter });
}
