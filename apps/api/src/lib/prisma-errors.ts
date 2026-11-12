import { Prisma } from "../generated/prisma/client.js";

/** Violación de una restricción única (P2002). */
export function esViolacionUnica(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Nombre de la restricción de exclusión violada (SQLSTATE 23P01), o `null` si el error es otro.
 * Con el adaptador `pg`, Prisma entrega el error original de PostgreSQL en `meta.driverAdapterError`.
 */
export function restriccionDeExclusion(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  const causa = (error.meta?.driverAdapterError as { cause?: { originalCode?: string; originalMessage?: string } })
    ?.cause;
  if (causa?.originalCode !== "23P01") {
    return null;
  }
  return /exclusion constraint "([^"]+)"/.exec(causa.originalMessage ?? "")?.[1] ?? "";
}
