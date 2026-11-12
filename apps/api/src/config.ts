import { z } from "zod";
import { esPoligono, type Poligono } from "./lib/geo.js";

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string({ error: "Configura DATABASE_URL para iniciar la API." }).min(1),
  ALLOWED_EMAIL_DOMAINS: z.string().default("demo.uc.cl"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(720),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  TOLERANCIA_LLEGADA_MIN: z.coerce.number().int().min(0).max(120).default(15),
  TOLERANCIA_SALIDA_MIN: z.coerce.number().int().min(0).max(120).default(10),
  PERIMETRO_PRUEBA: z.string().optional(),
  MARGEN_PERIMETRO_M: z.coerce.number().min(0).max(1000).default(50),
});

export type AuthConfig = {
  /** Dominios de correo admitidos para registrarse, en minúsculas. */
  allowedEmailDomains: string[];
  sessionTtlHours: number;
  bcryptRounds: number;
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

export type AppConfig = {
  port: number;
  adminOrigin: string;
  databaseUrl: string;
  auth: AuthConfig;
  reservas: ReservasConfig;
};

/** Configuración que necesita `createApp`; el puerto y la URL de la base solo los usa el servidor. */
export type RuntimeConfig = Omit<AppConfig, "port" | "databaseUrl">;

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
    },
    reservas: {
      toleranciaLlegadaMin: values.TOLERANCIA_LLEGADA_MIN,
      toleranciaSalidaMin: values.TOLERANCIA_SALIDA_MIN,
      perimetroPrueba: leerPerimetro(values.PERIMETRO_PRUEBA),
      margenPerimetroM: values.MARGEN_PERIMETRO_M,
    },
  };
}
