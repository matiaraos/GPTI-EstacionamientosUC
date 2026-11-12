import { z } from "zod";
import { esPoligono, type Poligono } from "./lib/geo.js";

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string({ error: "Configura DATABASE_URL para iniciar la API." }).min(1),
  ALLOWED_EMAIL_DOMAINS: z.string().default("demo.uc.cl"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(720),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  RECUPERACION_TTL_MIN: z.coerce.number().int().min(5).max(1440).default(30),
  RECUPERACION_URL: z.string().default("miestacionamientouc://restablecer"),
  SMTP_URL: z.string().optional(),
  CORREO_REMITENTE: z.string().default("MiEstacionamientoUC <no-responder@demo.uc.cl>"),
  TOLERANCIA_LLEGADA_MIN: z.coerce.number().int().min(0).max(120).default(15),
  TOLERANCIA_SALIDA_MIN: z.coerce.number().int().min(0).max(120).default(10),
  PERIMETRO_PRUEBA: z.string().optional(),
  RANKING_INICIAL: z.coerce.number().int().default(100),
  RANKING_AUSENCIA: z.coerce.number().int().max(0).default(-10),
  RANKING_VENCIMIENTO: z.coerce.number().int().max(0).default(-5),
  RANKING_SALIDA_TARDIA: z.coerce.number().int().max(0).default(-3),
  RANKING_SALIDA_A_TIEMPO: z.coerce.number().int().min(0).default(1),
  VENCIMIENTOS_INTERVALO_S: z.coerce.number().int().min(0).default(60),
  MARGEN_PERIMETRO_M: z.coerce.number().min(0).max(1000).default(50),
});

export type AuthConfig = {
  /** Dominios de correo admitidos para registrarse, en minúsculas. */
  allowedEmailDomains: string[];
  sessionTtlHours: number;
  bcryptRounds: number;
  /** Vigencia del enlace de recuperación de contraseña, en minutos (01B). */
  recuperacionTtlMin: number;
  /** Enlace que abre la app en la pantalla para elegir la nueva contraseña; se le agrega `?token=`. */
  recuperacionUrl: string;
};

export type ReservasConfig = {
  /** Minutos antes y después de la hora de llegada en que se admite el check-in (05A). */
  toleranciaLlegadaMin: number;
  /** Minutos después de la hora de salida en que se admite el check-out (05A). */
  toleranciaSalidaMin: number;
  /** Perímetro donde se admite la llegada. Si falta, se usa el del campus cargado del catálogo. */
  perimetroPrueba: Poligono | null;
  /** Margen en metros alrededor del perímetro para absorber el error del GPS. */
  margenPerimetroM: number;
};

/**
 * Tabla de ajustes de ranking (RN-06 y RN-07). Valores propuestos y configurables, pendientes de
 * confirmar para el piloto. Un error de lectura del QR no tiene ajuste.
 */
export type RankingConfig = {
  puntajeInicial: number;
  ausencia: number;
  vencimiento: number;
  salidaTardia: number;
  salidaATiempo: number;
};

export type AppConfig = {
  port: number;
  adminOrigin: string;
  databaseUrl: string;
  auth: AuthConfig;
  reservas: ReservasConfig;
  ranking: RankingConfig;
  /** Cada cuántos segundos se procesan ausencias y vencimientos (0 = desactivado). */
  vencimientosIntervaloS: number;
  correo: { smtpUrl: string | null; remitente: string };
};

/** Configuración que necesita `createApp`; el puerto, la base y el correo solo los usa el servidor. */
export type RuntimeConfig = Omit<AppConfig, "port" | "databaseUrl" | "correo" | "vencimientosIntervaloS">;

export function parseEmailDomains(value: string): string[] {
  return value
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

function leerPerimetro(valor: string | undefined): Poligono | null {
  if (!valor?.trim()) {
    return null;
  }
  let geometria: unknown;
  try {
    geometria = JSON.parse(valor);
  } catch {
    throw new Error("Configuración inválida. PERIMETRO_PRUEBA debe ser un polígono GeoJSON en JSON.");
  }
  if (!esPoligono(geometria)) {
    throw new Error('Configuración inválida. PERIMETRO_PRUEBA debe tener la forma {"type":"Polygon","coordinates":[[[lon,lat],…]]}.');
  }
  return geometria;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuración inválida. ${detail}`);
  }
  const values = parsed.data;
  const allowedEmailDomains = parseEmailDomains(values.ALLOWED_EMAIL_DOMAINS);
  if (allowedEmailDomains.length === 0) {
    throw new Error("Configuración inválida. ALLOWED_EMAIL_DOMAINS debe indicar al menos un dominio.");
  }
  return {
    port: values.PORT,
    adminOrigin: values.ADMIN_ORIGIN,
    databaseUrl: values.DATABASE_URL,
    auth: {
      allowedEmailDomains,
      sessionTtlHours: values.SESSION_TTL_HOURS,
      bcryptRounds: values.BCRYPT_ROUNDS,
      recuperacionTtlMin: values.RECUPERACION_TTL_MIN,
      recuperacionUrl: values.RECUPERACION_URL,
    },
    reservas: {
      toleranciaLlegadaMin: values.TOLERANCIA_LLEGADA_MIN,
      toleranciaSalidaMin: values.TOLERANCIA_SALIDA_MIN,
      perimetroPrueba: leerPerimetro(values.PERIMETRO_PRUEBA),
      margenPerimetroM: values.MARGEN_PERIMETRO_M,
    },
    ranking: {
      puntajeInicial: values.RANKING_INICIAL,
      ausencia: values.RANKING_AUSENCIA,
      vencimiento: values.RANKING_VENCIMIENTO,
      salidaTardia: values.RANKING_SALIDA_TARDIA,
      salidaATiempo: values.RANKING_SALIDA_A_TIEMPO,
    },
    vencimientosIntervaloS: values.VENCIMIENTOS_INTERVALO_S,
    correo: { smtpUrl: values.SMTP_URL?.trim() || null, remitente: values.CORREO_REMITENTE },
  };
}
