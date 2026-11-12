import { ApiError } from "./client";

/** Separa los errores por campo del mensaje general para mostrarlos junto a cada campo. */
export function describeError(error: unknown): { message: string | null; fields: Record<string, string> } {
  if (!error) {
    return { message: null, fields: {} };
  }
  if (error instanceof ApiError) {
    const fields = error.details ?? {};
    // Si cada problema ya se muestra en su campo, el mensaje general solo resume.
    return { message: error.message, fields };
  }
  return { message: "Ocurrió un error inesperado. Inténtalo de nuevo.", fields: {} };
}
