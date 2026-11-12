import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string({ error: "Configura DATABASE_URL para iniciar la API." }).min(1),
});

export type AppConfig = {
  port: number;
  adminOrigin: string;
  databaseUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuración inválida. ${detail}`);
  }
  const values = parsed.data;
  return {
    port: values.PORT,
    adminOrigin: values.ADMIN_ORIGIN,
    databaseUrl: values.DATABASE_URL,
  };
}
