import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import type { ActionBundle, RiskLevel, SimulateResponse } from "@/services/types";
import { fmt } from "@/lib/risk";
import { RiskBadge } from "@/components/ui/RiskBadge";
import RiskGauge from "@/components/ui/RiskGauge";
import { InlineMetric, DemoNotice } from "@/components/ui/Feedback";

interface Sliders {
  temperature: number;
  humidity: number;
  wind_speed: number;
  solar_radiation: number;
  elderly_scale: number;
  outdoor_worker_scale: number;
  population_density_scale: number;
}

const DEFAULT: Sliders = {
  temperature: 43,
  humidity: 58,
  wind_speed: 2,
  solar_radiation: 780,
  elderly_scale: 1.0,
  outdoor_worker_scale: 1.0,
  population_density_scale: 1.0,
};

const SLIDER_DEFS: {
  key: keyof Sliders;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "temperature", label: "Temperature", min: 25, max: 50, step: 0.5, unit: "°C" },
  { key: "humidity", label: "Humidity", min: 10, max: 95, step: 1, unit: "%" },
  { key: "wind_speed", label: "Wind speed", min: 0, max: 12, step: 0.5, unit: "m/s" },
  { key: "solar_radiation", label: "Solar radiation", min: 0, max: 1200, step: 10, unit: "W/m²" },
  { key: "elderly_scale", label: "Elderly population", min: 0.5, max: 1.5, step: 0.05, unit: "×" },
  { key: "outdoor_worker_scale", label: "Outdoor worker density", min: 0.5, max: 1.5, step: 0.05, unit: "×" },
  { key: "population_density_scale", label: "Population density", min: 0.5, max: 1.5, step: 0.05, unit: "×" },
];

interface DriversRow {
  feature: string;
  percent_contribution: number;
  direction: string;
}

export default function ScenarioSimulator({
  embedded = false,
}: {
  /** When embedded, renders a compact single-column layout. */
  embedded?: boolean;
}) {
  const [sliders, setSliders] = useState<Sliders>(DEFAULT);
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [drivers, setDrivers] = useState<DriversRow[]>([]);
  const [actions, setActions] = useState<ActionBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const mounted = useRef(true);

  const run = useCallback((s: Sliders) => {
    setLoading(true);
    api
      .simulate(s)
      .then(async (r) => {
        if (!mounted.current) return;
        setResult(r);
        setError(null);
        // Live explainability + recommended actions for the simulated outcome.
        const level = r.prediction.risk_level;
        try {
          const rec = await api.recommendations(level);
          setActions({ ...(rec as ActionBundle), level });
        } catch {
          /* action table is best-effort */
        }
        try {
          const d = await api.wardDetail(r.summary.highest_risk_ward);
          const top = (d?.explain?.contributions ?? [])
            .filter((c) => c.direction !== "down")
            .sort((a, b) => b.percent_contribution - a.percent_contribution)
            .slice(0, 3)
            .map((c) => ({
              feature: c.feature,
              percent_contribution: c.percent_contribution,
              direction: c.direction,
            }));
          setDrivers(top);
        } catch {
          setDrivers([]);
        }
      })
      .catch((e: unknown) => {
        if (!mounted.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => mounted.current && setLoading(false));
  }, []);

  useEffect(() => {
    mounted.current = true;
    run(DEFAULT);
    return () => {
      mounted.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (key: keyof Sliders, value: number) => {
    const next = { ...sliders, [key]: value };
    setSliders(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => run(next), 220);
  };

  const reset = () => {
    setSliders(DEFAULT);
    if (timer.current) window.clearTimeout(timer.current);
    run(DEFAULT);
  };

  const pred = result?.prediction;
  const thermalValue = (k: "heat_index" | "wbgt" | "utci") =>
    fmt.num(result?.thermal?.[k] ?? 0);

  return (
    <div className={embedded ? "grid gap-4 xl:grid-cols-2" : "grid gap-4 lg:grid-cols-2"}>
      {/* Controls */}
      <div className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-700" />
            <p className="text-sm font-bold text-slate-900">Heat Scenario Simulator</p>
          </div>
          <button type="button" onClick={reset} className="btn-ghost -mr-2 p-1.5" title="Reset to default">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Adjust simulated conditions — the risk score, thermal metrics, drivers and recommended actions
          update live. Try raising temperature by 2 °C to see the result.
        </p>
        <div className="space-y-4">
          {SLIDER_DEFS.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">{d.label}</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {sliders[d.key]} {d.unit}
                </span>
              </div>
              <input
                type="range"
                min={d.min}
                max={d.max}
                step={d.step}
                value={sliders[d.key]}
                onChange={(e) => setValue(d.key, parseFloat(e.target.value))}
                aria-label={d.label}
              />
            </div>
          ))}
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <DemoNotice
          compact
          className="mt-4"
          text="Simulated conditions from the Heat Scenario Simulator — prototype demonstration."
        />
      </div>

      {/* Live results */}
      <div className="space-y-4">
        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <p className="label">Predicted Human Heat Risk</p>
            {pred && <RiskBadge level={pred.risk_level as RiskLevel} size="lg" />}
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {pred ? Math.round(pred.risk_score) : "—"}
            <span className="text-base font-medium text-slate-400"> / 100</span>
          </p>
          <div className="mt-3">
            {pred && <RiskGauge score={pred.risk_score} size="lg" />}
          </div>
          {loading && <p className="mt-2 text-[11px] text-slate-400">Recomputing…</p>}
          <p className="mt-2 text-[11px] text-slate-400">
            Highest-risk demo ward: {result?.summary.highest_risk_ward ?? "—"} · alerts:{" "}
            {result?.summary.active_alerts ?? 0} · vulnerable pop:{" "}
            {fmt.int(result?.summary.vulnerable_population_demo_estimate ?? 0)} (demo estimate)
          </p>
        </div>

        <div className="card card-pad">
          <p className="label mb-3">Thermal stress metrics</p>
          <div className="grid grid-cols-3 gap-3">
            <InlineMetric label="Heat Index" value={thermalValue("heat_index")} suffix="°C" />
            <InlineMetric label="WBGT" value={thermalValue("wbgt")} suffix="°C" />
            <InlineMetric label="UTCI" value={thermalValue("utci")} suffix="°C" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Temperature alone does not represent human heat stress. HEATSHIELD combines humidity, wind and
            solar radiation together with vulnerability to estimate human thermal stress (demo formulas —
            see Thermal Engine page for assumptions).
          </p>
        </div>

        {drivers.length > 0 && (
          <div className="card card-pad">
            <p className="label mb-2">Why is the risk high right now?</p>
            <ul className="space-y-1.5">
              {drivers.map((d) => (
                <li
                  key={d.feature}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium capitalize text-slate-700">
                    {d.feature.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-semibold text-blue-700">
                    +{d.percent_contribution.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10px] text-slate-400">Illustrative prototype model contribution.</p>
          </div>
        )}

        {actions && (
          <div className="card card-pad">
            <div className="mb-2 flex items-center justify-between">
              <p className="label">Recommended actions · {actions.level}</p>
              <RiskBadge level={actions.level as RiskLevel} size="sm" />
            </div>
            <ul className="space-y-1.5">
              {actions.actions.slice(0, 4).map((a: string) => (
                <li key={a} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}