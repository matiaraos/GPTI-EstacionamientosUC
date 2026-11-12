/** Normaliza un correo para compararlo y guardarlo: sin espacios y en minúsculas. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function dominioDeCorreo(correo: string): string {
  return correo.slice(correo.lastIndexOf("@") + 1);
}

/** Quita espacios, guiones, puntos y separadores y pasa a mayúsculas: "ab-12·34" → "AB1234". */
export function normalizarPatente(patente: string): string {
  return patente.toUpperCase().replace(/[\s\-.·•]/g, "");
}

// Formato antiguo: dos letras y cuatro dígitos (AB1234).
const PATENTE_ANTIGUA = /^[A-Z]{2}\d{4}$/;
// Formato vigente desde 2007: cuatro consonantes sin M, N, Ñ ni Q, y dos dígitos (BCDF12).
const PATENTE_ACTUAL = /^[BCDFGHJKLPRSTVWXYZ]{4}\d{2}$/;

/** Patentes chilenas de automóvil. Recibe la patente ya normalizada. */
export function esPatenteChilenaValida(patente: string): boolean {
  return PATENTE_ANTIGUA.test(patente) || PATENTE_ACTUAL.test(patente);
}
