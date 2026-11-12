// PP-25 · 50 usuarios concurrentes solicitan una plaza; cada respuesta debe llegar en menos de 5 s.
// Requiere la API local migrada y con `npm run db:seed`. Uso:
//   k6 run -e FECHA=2026-11-23 tests/load/asignacion.js
// Las respuestas válidas son 201 (reserva) o 409 (sin cupo, con oferta de espera).
import http from "k6/http";
import { check } from "k6";

const apiUrl = (__ENV.API_URL || "http://localhost:3000").replace(/\/+$/, "");
const fecha = __ENV.FECHA || "2026-11-23";
const dominio = __ENV.DOMINIO || "demo.uc.cl";
const usuarios = 50;

export const options = {
  scenarios: {
    pp25: { executor: "per-vu-iterations", vus: usuarios, iterations: 1, maxDuration: "1m" },
  },
  thresholds: {
    "http_req_duration{operacion:reservar}": ["max<5000"],
    checks: ["rate==1"],
  },
};

export function setup() {
  const destinos = http.get(`${apiUrl}/health`);
  if (destinos.status !== 200) throw new Error("La API no responde en " + apiUrl);
  const corrida = Date.now().toString(36);
  const tokens = [];
  for (let i = 0; i < usuarios; i++) {
    const correo = `pp25-${corrida}-${i}@${dominio}`;
    const letras = "BCDFGHJKLPRSTVWXYZ";
    const patente = Array.from({ length: 4 }, (_, j) => letras[(i * 7 + j * 3 + corrida.length + Number.parseInt(corrida.slice(-3), 36)) % letras.length]).join("") + String(i).padStart(2, "0");
    const cuerpo = JSON.stringify({ correo, contrasena: "carga-pp25-2026", patente });
    const json = { headers: { "Content-Type": "application/json" } };
    http.post(`${apiUrl}/auth/registro`, cuerpo, json);
    const sesion = http.post(`${apiUrl}/auth/sesion`, JSON.stringify({ correo, contrasena: "carga-pp25-2026" }), json);
    tokens.push(sesion.json("token"));
  }
  const busqueda = http.get(`${apiUrl}/destinos?q=ED113`, { headers: { Authorization: `Bearer ${tokens[0]}` } });
  return { tokens, destinoId: busqueda.json("destinos.0.id") };
}

export default function ({ tokens, destinoId }) {
  const token = tokens[__VU - 1];
  const response = http.post(
    `${apiUrl}/reservas`,
    JSON.stringify({ fecha, llegada: "09:00", salida: "12:00", destinoId }),
    {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": `pp25-${__VU}-${Date.now()}` },
      tags: { operacion: "reservar" },
      timeout: "10s",
    },
  );
  check(response, { "reserva o sin cupo": (r) => r.status === 201 || r.status === 409 });
}
