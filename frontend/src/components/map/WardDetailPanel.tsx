import { useEffect } from "react";
import { Users, Building2, HeartPulse, AlertTriangle, Loader2, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import { fmt } from "@/lib/risk";
import { RiskBadge } from "@/components/ui/RiskBadge";
import RiskGauge from "@/components/ui/RiskGauge";
import { InlineMetric, DemoNotice } from "@/components/ui/Feedback";
import DriverContribBar from "@/charts/DriverContribBar";
import type { Contribution, RiskLevel } from "@/services/types";

function MetricGrid({ detail }: { detail: { [k: string]: number } }) {
  const rows = [
    { label: "Temperature", value: detail.temperature, unit: "°C" },
    { label: "Humidity", value: detail.humidity, unit: "%" },
    { label: "WBGT", value: detail.wbgt, unit: "°C" },
    { label: "UTCI", value: detail.utci, unit: "°C" },
    { label: "Heat Index", value: detail.heat_index, unit: "°C" },
    { label: "Wind", value: detail.wind_speed, unit: "m/s" },
    { label: "Solar", value: detail.solar_radiation, unit: "W/m²" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((r) => (
        <InlineMetric key={r.label} label={r.label} value={fmt.num(r.value as number)} suffix={r.unit} />
      ))}
    </div>
  );
}

export default function WardDetailPanel() {
  const { selectedWardId, setSelectedWardId, scenario } = useApp();

  const { data: detail, loading, error } = useApiData(
    () => (selectedWardId ? api.wardDetail(selectedWardId, scenario) : Promise.resolve(null)),
    [selectedWardId, scenario]
  );

  useEffect(() => {
    if (!selectedWardId) setSelectedWardId("W07");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!selectedWardId) return <div className="card card-pad text-sm text-slate-400">Select a ward on the map.</div>;
  if (loading)
    return (
      <div className="card card-pad">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ward {selectedWardId}…
        </div>
      </div>
    );
  if (error || !detail)
    return (
      <div className="card card-pad">
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4" /> {error ?? "Ward not found"}
        </div>
      </div>
    );

  const convert = (list: unknown[]): Contribution[] => list as Contribution[];
  const topDrivers = (detail.explain?.contributions ?? [])
    .filter((c) => c.direction !== "down")
    .sort((a, b) => b.percent_contribution - a.percent_contribution)
    .slice(0, 3);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"
        style={{ backgroundColor: `${detail.risk_level === "EXTREME" ? "#fef2f2" : detail.risk_level === "HIGH" ? "#fff7ed" : "#ffffff"}` }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{detail.ward_name}</h3>
            <RiskBadge level={detail.risk_level as RiskLevel} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {detail.ward_id} · Simulated demo ward
          </p>
        </div>
        <button type="button" onClick={() => setSelectedWardId(null)} className="btn-ghost -mr-1 p-1.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="label mb-1">Risk Score</p>
            <p className="text-3xl font-bold tabular-nums text-slate-900">
              {Math.round(detail.risk_score)}
              <span className="text-base font-medium text-slate-400"> / 100</span>
            </p>
            <div className="mt-2">
              <RiskGauge score={detail.risk_score} />
            </div>
          </div>
          <div className="hidden w-40 shrink-0 gap-3 sm:grid">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="label">Vulnerable population</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {fmt.int(detail.population)}
              </p>
              <p className="text-[10px] text-slate-400">Demo estimate</p>
            </div>
          </div>
        </div>

        <MetricGrid
          detail={{
            temperature: detail.temperature,
            humidity: detail.humidity,
            wbgt: detail.wbgt,
            utci: detail.utci,
            heat_index: detail.heat_index,
            wind_speed: detail.wind_speed,
            solar_radiation: detail.solar_radiation,
          }}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
            <Users className="h-4 w-4 text-slate-500" />
            <div>
              <p className="label">Population</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{fmt.int(detail.population)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
            <Building2 className="h-4 w-4 text-slate-500" />
            <div>
              <p className="label">Hospital</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{fmt.num(detail.hospital_proximity_km)} km</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
            <HeartPulse className="h-4 w-4 text-slate-500" />
            <div>
              <p className="label">Health proxy</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {detail.health_proxy?.length
                  ? `${detail.health_proxy[detail.health_proxy.length - 1].heat_illness_consults_proxy} consults`
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="label mb-2">Main risk drivers</p>
          {topDrivers.length ? (
            <ul className="space-y-1.5">
              {topDrivers.map((d) => (
                <li key={d.feature} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium capitalize text-slate-700">
                    {d.feature.replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {d.percent_contribution.toFixed(0)}% contribution
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">+</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No drivers available.</p>
          )}
        </div>

        <div>
          <p className="label mb-2">Recommended action ({detail.recommendations?.heading})</p>
          <ul className="space-y-1.5">
            {(detail.recommendations?.actions ?? []).slice(0, 4).map((a: string) => (
              <li key={a} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                {a}
              </li>
            ))}
          </ul>
          <DemoNotice compact text={detail.recommendations?.prototype_note ?? ""} className="mt-2" />
        </div>

        <div>
          <p className="label mb-2">Why is this ward at risk?</p>
          <div className="rounded-lg border border-slate-200 p-2">
            <DriverContribBar contributions={convert(detail.explain?.contributions ?? [])} height={200} />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {detail.explain?.note ?? ""} Illustrative prototype contribution, not scientific attribution.
          </p>
        </div>

        <DemoNotice compact text={detail.demo_note ?? ""} />
      </div>
    </div>
  );
}