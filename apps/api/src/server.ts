import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createApp } from "./app.js";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Configura DATABASE_URL para iniciar la API.");
}

const port = Number(process.env.PORT ?? 3000);
const adminOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:5173";
const adapter = new PrismaPg({
  connectionString,
  connectionTimeoutMillis: 2500,
  statement_timeout: 2500,
});
const prisma = new PrismaClient({ adapter });

const app = createApp(adminOrigin, () => prisma.parkingZone.findFirst({ select: { id: true } }));
app.listen(port, "0.0.0.0", () => {
  console.log(`API de MiEstacionamientoUC escuchando en el puerto ${port}`);
});
