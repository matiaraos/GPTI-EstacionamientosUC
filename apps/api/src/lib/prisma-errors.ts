import { Prisma } from "../generated/prisma/client.js";

/** Violación de una restricción única (P2002). */
export function esViolacionUnica(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
