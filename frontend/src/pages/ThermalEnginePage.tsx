import { useCallback, useEffect, useRef, useState } from "react";
import { Thermometer, ArrowDown } from "lucide-react";
import { api } from "@/services/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import RiskGauge from "@/components/ui/RiskGauge";
import { InlineMetric, DemoNotice } from "@/components/ui/Feedback";
import { fmt } from "@/lib/risk";
import type { RiskLevel, ThermalMetrics } from "@/services/types";

interface Env {
  temperature: number;
  humidity: number;
  wind_speed: number;
  solar_radiation: number;
}

const DEFAULT_ENV: Env = { temperature: 40, humidity: 55, wind_speed: 2.5, solar_radiation: 700 };

const CONTROLS: { key: keyof Env; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "temperature", label: "Air temperature", min: 20, max: 50, step: 0.5, unit: "°C" },
  { key: "humidity", label: "Relative humidity", min: 10, max: 95, step: 1, unit: "%" },
  { key: "wind_speed", label: "Wind speed", min: 0, max: 12, step: 0.5, unit: "m/s" },
  { key: "solar_radiation", label: "Solar radiation", min: 0, max: 1200, step: 10, unit: "W/m²" },
];

export default function ThermalEnginePage() {
  const [env, setEnv] = useState<Env>(DEFAULT_ENV);
  const [thermal, setThermal] = useState<ThermalMetrics | null>(null);
  const [pred, setPred] = useState<{ risk_score: number; risk_level: RiskLevel; confidence: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const mounted = useRef(true);

  const compute = useCallback((e: Env) => {
    setLoading(true);
    Promise.all([
      api.thermalStress(e),
      api.predictRisk({
        temperature: e.temperature,
        humidity: e.humidity,
        wind_speed: e.wind_speed,
        solar_radiation: e.solar_radiation,
        elderly_density: 0.18,
        outdoor_worker_density: 0.21,
        population_density: 0.65,
      }),
    ])
      .then(([t, p]) => {
        if (!mounted.current) return;
        setThermal(t);
        setPred({ risk_score: p.risk_score, risk_level: p.risk_level, confidence: p.confidence });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mounted.current) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => mounted.current && setLoading(false));
  }, []);

  useEffect(() => {
    mounted.current = true;
    compute(DEFAULT_ENV);
    return () => {
      mounted.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (key: keyof Env, value: number) => {
    const next = { ...env, [key]: value };
    setEnv(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => compute(next), 150);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Thermal Stress Engine"
        title="Environmental Conditions → Human Thermal Stress → Risk"
        subtitle="Temperature alone does not represent human heat stress. HEATSHIELD combines temperature, humidity, wind and solar radiation."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Controls */}
        <Card title="Environmental conditions" subtitle="Adjust the inputs to see thermal stress change." className="lg:col-span-2">
          <div className="space-y-4">
            {CONTROLS.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{c.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {env[c.key]} {c.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={env[c.key]}
                  onChange={(e) => onChange(c.key, parseFloat(e.target.value))}
                  aria-label={c.label}
                />
              </div>
            ))}
          </div>
          <DemoNotice
            compact
            className="mt-4"
            text="Inputs are user-chosen demo conditions, not live measurement."
          />
        </Card>

        {/* Results */}
        <div className="space-y-4 lg:col-span-3">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <Card
            title="Thermal stress metrics"
            subtitle={loading ? "Recomputing…" : "Computed with documented prototype formulas"}
          >
            <div className="grid grid-cols-3 gap-3">
              <InlineMetric label="Heat Index" value={fmt.num(thermal?.heat_index ?? 0)} suffix="°C" />
              <InlineMetric label="WBGT" value={fmt.num(thermal?.wbgt ?? 0)} suffix="°C" />
              <InlineMetric label="UTCI" value={fmt.num(thermal?.utci ?? 0)} suffix="°C" />
            </div>
          </Card>

          <Card title="Human heat risk (prototype model)" subtitle="Prediction on the synthetic demo conditions">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-bold tabular-nums text-slate-900">
                  {pred ? Math.round(pred.risk_score) : "—"}
                  <span className="text-base font-medium text-slate-400"> / 100</span>
                </p>
                <div className="mt-3 max-w-sm">
                  {pred && <RiskGauge score={pred.risk_score} />}
                </div>
              </div>
              {pred && (
                <div className="text-right">
                  <RiskBadge level={pred.risk_level} size="lg" />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Prototype confidence {Math.round(pred.confidence * 100)}% (demo, not validated)
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Pipeline" subtitle="How the engine is structured">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
                Environmental Conditions
              </span>
              <ArrowDown className="h-4 w-4 text-slate-400" />
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-700">
                Thermal Stress Metrics (HI, WBGT, UTCI)
              </span>
              <ArrowDown className="h-4 w-4 text-slate-400" />
              <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700">
                Human Heat Risk
              </span>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Formulas & assumptions" subtitle="Prototype implementations — documented, not official laboratory instruments.">
        <div className="flex items-start gap-2">
          <Thermometer className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-xs leading-relaxed text-slate-600">
            Heat Index uses the NOAA/NWS Rothfusz (1990) regression (valid T &gt;= 27 °C; below that we report
            air temperature). WBGT uses the outdoor full-sun formula 0.7·Tnwb + 0.2·Tg + 0.1·Ta with Stull
            (2011) natural wet-bulb temperature and a simplified black-globe model. UTCI is documented as a{" "}
            <strong>proxy</strong> built on the same physical drivers — the official UTCI polynomial (Bröde et
            al., 2012) is not shipped in this prototype and is labelled as such. Full notes are returned by
            the API in <code className="rounded bg-slate-100 px-1">/api/thermal-stress</code>.
          </p>
        </div>
      </Card>
    </div>
  );
}