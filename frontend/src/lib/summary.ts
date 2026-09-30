import type { RiskLevel, WardSummary } from "@/services/types";

export interface ClientSummary {
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

/** Client-side equivalent of the backend RiskService.summary(). */
export function computeSummary(wards: WardSummary[]): ClientSummary {
  if (!wards.length) {
    return {
      current_risk_level: "LOW",
      current_risk_score: 0,
      highest_risk_ward: "—",
      highest_risk_ward_name: "—",
      forecast_horizon_days: 5,
      vulnerable_population_demo_estimate: 0,
      active_alerts: 0,
      wards_at: { LOW: 0, MODERATE: 0, HIGH: 0, EXTREME: 0 },
      demo_note: "computed from simulated demo wards",
    };
  }
  const max = wards.reduce((a, b) => (b.risk_score > a.risk_score ? b : a), wards[0]);
  const high = wards.filter((w) => w.risk_level === "HIGH" || w.risk_level === "EXTREME");
  const wards_at: Record<RiskLevel, number> = { LOW: 0, MODERATE: 0, HIGH: 0, EXTREME: 0 };
  for (const w of wards) wards_at[w.risk_level] += 1;
  return {
    current_risk_level: max.risk_level,
    current_risk_score: Math.round(max.risk_score),
    highest_risk_ward: max.ward_id,
    highest_risk_ward_name: max.ward_name,
    forecast_horizon_days: 5,
    vulnerable_population_demo_estimate: high.reduce((s, w) => s + w.population, 0),
    active_alerts: high.length,
    wards_at,
    demo_note: "Summary computed from simulated demo wards.",
  };
}