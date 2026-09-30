/**
 * HEATSHIELD AI - API client.
 *
 * Talks to the FastAPI backend through a Vite proxy (/api -> http://127.0.0.1:8000)
 * so no CORS URL has to be configured for the local prototype.
 */

import type {
  AlertsResponse,
  ForecastResponse,
  HealthResponse,
  ModelInfo,
  PredictRequest,
  PredictResponse,
  SimulateRequest,
  SimulateResponse,
  ThermalEnvironment,
  ThermalMetrics,
  WardDetail,
  WardsResponse,
} from "./types";
import type { ScenarioId } from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      // ignore json parse failure
    }
    throw new Error(`API ${res.status} ${path}: ${detail}`);
  }
  return (await res.json()) as T;
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return "";
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const api = {
  base: BASE,

  health: () => request<HealthResponse>("/health"),

  modelInfo: () => request<ModelInfo>("/model-info"),

  wards: (scenario?: ScenarioId) =>
    request<WardsResponse>(`/wards${qs({ scenario })}`),

  wardDetail: (wardId: string, scenario?: ScenarioId) =>
    request<WardDetail>(`/ward/${wardId}${qs({ scenario })}`),

  forecast: (scenario?: ScenarioId) =>
    request<ForecastResponse>(`/forecast${qs({ scenario })}`),

  alerts: (scenario?: ScenarioId) =>
    request<AlertsResponse>(`/alerts${qs({ scenario })}`),

  thermalStress: (env: ThermalEnvironment) =>
    request<ThermalMetrics>("/thermal-stress", {
      method: "POST",
      body: JSON.stringify(env),
    }),

  predictRisk: (req: PredictRequest) =>
    request<PredictResponse>("/predict-risk", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  simulate: (req: SimulateRequest) =>
    request<SimulateResponse>("/simulate", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  recommendations: (riskLevel: string) =>
    request<{ level: string; heading: string; actions: string[]; prototype_note: string }>(
      `/recommendations/${riskLevel}`
    ),
};