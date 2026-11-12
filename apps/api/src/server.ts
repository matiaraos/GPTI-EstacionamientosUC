import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./lib/prisma.js";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const app = createApp({ config, db });

app.listen(config.port, "0.0.0.0", () => {
  console.log(`API de MiEstacionamientoUC escuchando en el puerto ${config.port}`);
});
