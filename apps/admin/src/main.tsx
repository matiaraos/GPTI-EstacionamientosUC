import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ApiError } from "./api";
import { CodigosQrPage } from "./pages/codigos-qr";
import { CuentasPage } from "./pages/cuentas";
import { DiagnosticoPage } from "./pages/diagnostico";
import { AdminLayout } from "./pages/layout";
import { LoginPage } from "./pages/login";
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
