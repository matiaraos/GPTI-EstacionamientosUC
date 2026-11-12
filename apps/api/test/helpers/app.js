import request from "supertest";

export const testConfig = {
  adminOrigin: "http://localhost:5173",
  auth: {
    allowedEmailDomains: ["demo.uc.cl"],
    sessionTtlHours: 24,
    // Costo mínimo de bcrypt para que las pruebas sean rápidas.
    bcryptRounds: 4,
    recuperacionTtlMin: 30,
    recuperacionUrl: "miestacionamientouc://restablecer",
  },
  reservas: { toleranciaLlegadaMin: 15, toleranciaSalidaMin: 10, perimetroPrueba: null, margenPerimetroM: 50 },
  ranking: { puntajeInicial: 100, ausencia: -10, vencimiento: -5, salidaTardia: -3, salidaATiempo: 1 },
};

/** Reloj controlable: `clock.set(fecha)` y `clock.advance(ms)`. */
export function createClock(start = "2026-11-16T12:00:00.000Z") {
  let now = new Date(start);
  const clock = () => new Date(now);
  clock.set = (value) => {
    now = new Date(value);
  };
  clock.advance = (ms) => {
    now = new Date(now.getTime() + ms);
  };
  return clock;
}

export const datosRegistro = (sufijo = "1") => ({
  correo: `persona${sufijo}@demo.uc.cl`,
  contrasena: "contrasena-segura",
  patente: `AB${String(1000 + Number(sufijo)).padStart(4, "0")}`,
});

/** Registra una cuenta y devuelve el token de una sesión nueva. */
export async function registrarEIniciar(app, datos = datosRegistro()) {
  await request(app).post("/auth/registro").send(datos).expect(201);
  const response = await request(app)
    .post("/auth/sesion")
    .send({ correo: datos.correo, contrasena: datos.contrasena })
    .expect(201);
  return response.body.token;
}

/** Canal de correo en memoria: guarda los correos enviados en `mailer.enviados`. */
export function createMailer() {
  const enviados = [];
  return {
    enviados,
    async enviar(correo) {
      enviados.push(correo);
    },
  };
}
