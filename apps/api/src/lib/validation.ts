import type { z } from "zod";
import { HttpError, type ErrorDetails } from "./errors.js";

/** Valida datos de entrada y responde 400 con un mensaje por campo. */
export function parseInput<Schema extends z.ZodType>(schema: Schema, data: unknown): z.output<Schema> {
  const result = schema.safeParse(data ?? {});
  if (result.success) {
    return result.data;
  }
  const details: ErrorDetails = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") || "solicitud";
    details[field] ??= issue.message;
  }
  throw new HttpError(400, "datos_invalidos", "Revisa los datos ingresados.", details);
}
