import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export type Database = PrismaClient;

export function createDatabase(connectionString: string): Database {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 2500,
    statement_timeout: 2500,
  });
  return new PrismaClient({ adapter });
}
