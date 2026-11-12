import { z } from "zod";

/** Contraseña nueva (registro y recuperación). bcrypt solo considera los primeros 72 bytes. */
export const contrasenaNueva = z
  .string({ error: "Ingresa una contraseña." })
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .refine((value) => Buffer.byteLength(value) <= 72, "La contraseña es demasiado larga.");
