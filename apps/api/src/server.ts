import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { crearMailer } from "./lib/correo.js";
import { createDatabase } from "./lib/prisma.js";
import { crearNotificadorExpo, programarAvisos } from "./modules/avisos/envio.js";
import { programarVencimientos } from "./modules/ranking/vencimientos.js";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const mailer = crearMailer(config.correo.smtpUrl, config.correo.remitente);
const app = createApp({ config, db, mailer });

programarVencimientos(db, config.reservas, config.ranking, config.vencimientosIntervaloS);
programarAvisos(db, { notificador: crearNotificadorExpo(config.avisos.expoAccessToken), mailer }, config.avisos.intervaloS);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`API de MiEstacionamientoUC escuchando en el puerto ${config.port}`);
});
