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

/**
 * Conflicto transitorio que PostgreSQL resuelve abortando una transacción: interbloqueo (40P01) o
 * falla de serialización (40001). Prisma lo informa como P2034. La operación se puede reintentar.
 */
export function esConflictoReintentable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code === "P2034") {
    return true;
  }
  const codigo = (error.meta?.driverAdapterError as { cause?: { originalCode?: string } })?.cause?.originalCode;
  return codigo === "40P01" || codigo === "40001";
}

/** Nombre de la restricción o índice único violado (23505), o `null` si el error es otro. */
export function restriccionUnica(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  const causa = (error.meta?.driverAdapterError as { cause?: { originalCode?: string; originalMessage?: string } })
    ?.cause;
  if (causa?.originalCode === "23505") {
    return /unique constraint "([^"]+)"/.exec(causa.originalMessage ?? "")?.[1] ?? "";
  }
  return error.code === "P2002" ? "" : null;
}
