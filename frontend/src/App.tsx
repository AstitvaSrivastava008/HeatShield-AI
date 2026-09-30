import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import DashboardPage from "@/pages/DashboardPage";
import WardsPage from "@/pages/WardsPage";
import ForecastPage from "@/pages/ForecastPage";
import ThermalEnginePage from "@/pages/ThermalEnginePage";
import AiModelPage from "@/pages/AiModelPage";
import AlertsPage from "@/pages/AlertsPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wards" element={<WardsPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/thermal-engine" element={<ThermalEnginePage />} />
        <Route path="/ai-model" element={<AiModelPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      </Routes>
    </ErrorBoundary>
  );
}