/**
 * HEATSHIELD AI - shared frontend types.
 *
 * These mirror the FastAPI backend responses (backend/app/models/schemas.py
 * plus the JSON payloads produced by backend/app/services/*). Everything is
 * derived from DEMO / SYNTHETIC data.
 */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface SimulationBanner {
  demo: boolean;
  demoNote: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Health / meta
// ---------------------------------------------------------------------------
export interface HealthResponse {
  status: string;
  service: string;
  problem_statement: string;
  tagline: string;
  demo_data: boolean;
  model_loaded: boolean;
  model_explainer: string;
  providers: Record<string, string>;
  note: string;
}

// ---------------------------------------------------------------------------
// Wards / map
// ---------------------------------------------------------------------------
export interface WardSummary {
  ward_id: string;
  ward_name: string;
  centroid: [number, number] | null;
  boundary: GeoJSON.Feature | null;
  temperature: number;
  humidity: number;
  wind_speed: number;
  solar_radiation: number;
  wbgt: number;
  utci: number;
  heat_index: number;
  population: number;
  elderly_fraction: number;
  outdoor_worker_fraction: number;
  population_density_index: number;
  hospital_proximity_km: number;
  cooling_centre_count: number;
  risk_score: number;
  risk_level: RiskLevel;
  demo: boolean;
}

export interface Contribution {
  feature: string;
  value: number;
  contribution: number;
  direction: "up" | "down";
  percent_contribution: number;
}

export interface RiskExplain {
  explainer: "shap" | "model_feature_importance";
  contributions: Contribution[];
  note: string;
}

export interface ActionBundle {
  level: RiskLevel;
  heading: string;
  actions: string[];
  prototype_note: string;
}

export interface HealthProxyRow {
  ward_id: string;
  date: string;
  heat_illness_consults_proxy: number;
  ambulance_dispatch_proxy: number;
  note?: string;
}

export interface WardDetail extends WardSummary {
  explain: RiskExplain;
  recommendations: ActionBundle;
  health_proxy: HealthProxyRow[];
  demo_note: string;
}

export interface WardsResponse {
  scenario: string;
  ward_count: number;
  wards: WardSummary[];
  demo_note: string;
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------
export interface ForecastDay {
  day_label: string;
  date: string;
  temp_max_c: number;
  temp_mean_c: number;
  humidity_mean_pct: number;
  wind_speed_ms: number;
  solar_radiation_proxy: number;
  heat_index: number;
  wbgt: number;
  utci: number;
  risk_score: number;
  risk_level: RiskLevel;
  demo: boolean;
}

export interface ForecastResponse {
  horizon_days: number;
  days: ForecastDay[];
  scenario: string;
  demo_note: string;
}

// ---------------------------------------------------------------------------
// Summary / KPIs
// ---------------------------------------------------------------------------
export interface SummaryResponse {
  current_risk_level: RiskLevel;
  current_risk_score: number;
  highest_risk_ward: string;
  highest_risk_ward_name: string;
  forecast_horizon_days: number;
  vulnerable_population_demo_estimate: number;
  active_alerts: number;
  wards_at: Record<RiskLevel, number>;
  demo_note: string;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export interface AlertItem {
  id: string;
  severity: RiskLevel;
  ward_id: string;
  ward_name: string;
  risk_score: number;
  message: string;
  timestamp: string;
  demo: boolean;
}

export interface AlertsResponse {
  alerts: AlertItem[];
  scenario: string;
  demo_note: string;
}

// ---------------------------------------------------------------------------
// Thermal stress
// ---------------------------------------------------------------------------
export interface ThermalMetrics {
  heat_index: number;
  wbgt: number;
  utci: number;
  units: {
    temperature: string;
    humidity: string;
    wind: string;
    solar_radiation: string;
  };
  notes: string[];
}

export interface ThermalEnvironment {
  temperature: number;
  humidity: number;
  wind_speed: number;
  solar_radiation: number;
}

// ---------------------------------------------------------------------------
// ML prediction
// ---------------------------------------------------------------------------
export interface PredictRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  solar_radiation: number;
  elderly_density: number;
  outdoor_worker_density: number;
  population_density: number;
}

export interface PredictResponse {
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  features: Record<string, number>;
  explainer: string;
  confidence_label: string;
}

export interface SimulateRequest {
  temperature: number;
  humidity: number;
  wind_speed: number;
  solar_radiation: number;
  elderly_scale: number;
  outdoor_worker_scale: number;
  population_density_scale: number;
}

export interface SimulateResponse {
  conditions: ThermalEnvironment;
  thermal: Omit<ThermalMetrics, "units" | "notes">;
  prediction: { risk_score: number; risk_level: RiskLevel };
  summary: {
    current_risk_level: RiskLevel;
    highest_risk_ward: string;
    vulnerable_population_demo_estimate: number;
    active_alerts: number;
  };
  wards: WardSummary[];
  demo_note: string;
}

// ---------------------------------------------------------------------------
// Model info
// ---------------------------------------------------------------------------
export interface ModelInfo {
  trained_on: string;
  demo_data: boolean;
  model: string;
  features: string[];
  metrics: { mae_score_points: number; r2: number };
  n_samples: number;
  generated_at: string;
  risk_levels: Record<RiskLevel, [number, number]>;
  explainer_available: boolean;
  confidence_definition: string;
  demo_note: string;
}

// ---------------------------------------------------------------------------
// Scenarios & recommendations
// ---------------------------------------------------------------------------
export interface ScenarioInfo {
  id: string;
  label: string;
  demo: boolean;
}

export type ScenarioId = "normal" | "high_heat" | "extreme_heat" | "extreme_vulnerable";