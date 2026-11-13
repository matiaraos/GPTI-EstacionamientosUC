import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ApiError } from "./api";
import { AutorizacionesPage } from "./pages/autorizaciones";
import { BloqueosPage } from "./pages/bloqueos";
import { CodigosQrPage } from "./pages/codigos-qr";
import { CuentasPage } from "./pages/cuentas";
import { DestinosPage } from "./pages/destinos";
import { DiagnosticoPage } from "./pages/diagnostico";
import { IncidentesPage } from "./pages/incidentes";
import { IndicadoresPage } from "./pages/indicadores";
import { InventarioPage } from "./pages/inventario";
import { OcupacionPage } from "./pages/ocupacion";
import { AdminLayout } from "./pages/layout";
import { LoginPage } from "./pages/login";
import { RankingPage } from "./pages/ranking";
import { SessionProvider } from "./session";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/ingresar" element={<LoginPage />} />
            <Route element={<AdminLayout />}>
              <Route index element={<CuentasPage />} />
              <Route path="ocupacion" element={<OcupacionPage />} />
              <Route path="incidentes" element={<IncidentesPage />} />
              <Route path="indicadores" element={<IndicadoresPage />} />
              <Route path="inventario" element={<InventarioPage />} />
              <Route path="bloqueos" element={<BloqueosPage />} />
              <Route path="destinos" element={<DestinosPage />} />
              <Route path="autorizaciones" element={<AutorizacionesPage />} />
              <Route path="ranking" element={<RankingPage />} />
              <Route path="codigos-qr" element={<CodigosQrPage />} />
              <Route path="diagnostico" element={<DiagnosticoPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
