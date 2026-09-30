/**
 * Risk-level helpers shared across the dashboard (colours, rank, labels).
 */

import type { RiskLevel } from "@/services/types";

export const RISK_ORDER: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "EXTREME"];

export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; bg: string; border: string; text: string; hex: string }
> = {
  LOW: {
    label: "LOW",
    color: "#16a34a",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    hex: "#16a34a",
  },
  MODERATE: {
    label: "MODERATE",
    color: "#ca8a04",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    hex: "#f59e0b",
  },
  HIGH: {
    label: "HIGH",
    color: "#ea580c",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    hex: "#f97316",
  },
  EXTREME: {
    label: "EXTREME",
    color: "#dc2626",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    hex: "#dc2626",
  },
};

/** Stable categorical colours for features / wards (professional, not neon). */
export const SERIES_COLORS = [
  "#1d4ed8",
  "#0ea5e9",
  "#f59e0b",
  "#16a34a",
  "#64748b",
  "#7c3aed",
];

export function riskColor(level: RiskLevel): string {
  return RISK_META[level]?.color ?? "#64748b";
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 25) return "LOW";
  if (score <= 50) return "MODERATE";
  if (score <= 75) return "HIGH";
  return "EXTREME";
}

export const fmt = {
  int: (n: number): string => n.toLocaleString("en-IN"),
  pct: (n: number): string => `${Math.round(n * 100)}%`,
  num: (n: number, d = 1): string =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }),
};

export const FEATURE_LABELS: Record<string, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
  wind_speed: "Wind Speed",
  solar_radiation: "Solar Radiation",
  wbgt: "WBGT",
  utci: "UTCI",
  heat_index: "Heat Index",
  elderly_density: "Elderly Density",
  outdoor_worker_density: "Outdoor Worker Density",
  population_density: "Population Density",
  historical_heat_impact_proxy: "Historical Heat Impact",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ");
}

/** Human-readable unit for a feature key used in driver charts. */
export function featureUnit(feature: string): string {
  switch (feature) {
    case "temperature":
      return "°C";
    case "humidity":
      return "%";
    case "wind_speed":
      return "m/s";
    case "solar_radiation":
      return "W/m²";
    case "elderly_density":
    case "outdoor_worker_density":
    case "population_density":
    case "historical_heat_impact_proxy":
      return "index";
    default:
      return "";
  }
}