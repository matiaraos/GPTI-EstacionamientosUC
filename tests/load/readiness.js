import http from "k6/http";
import { check } from "k6";

const apiUrl = (__ENV.API_URL || "http://localhost:3000").replace(/\/+$/, "");

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: { checks: ["rate==1"] },
};

export default function () {
  const response = http.get(`${apiUrl}/ready`, { timeout: "5s" });
  check(response, { "API y PostgreSQL disponibles": (result) => result.status === 200 });
}
