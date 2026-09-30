import { useApp } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { DemoNotice, LoadingState, ErrorState } from "@/components/ui/Feedback";
import RiskTrendChart from "@/charts/RiskTrendChart";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fmt } from "@/lib/risk";

function MetricTable({ days }: { days: Awaited<ReturnType<typeof api.forecast>>["days"] }) {
  return (
    <div className="overflow-x-auto nice-scroll">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2.5 font-semibold">Day</th>
            <th className="px-3 py-2.5 font-semibold">Max Temp</th>
            <th className="px-3 py-2.5 font-semibold">Humidity</th>
            <th className="px-3 py-2.5 font-semibold">Wind</th>
            <th className="px-3 py-2.5 font-semibold">Solar</th>
            <th className="px-3 py-2.5 font-semibold">Heat Index</th>
            <th className="px-3 py-2.5 font-semibold">WBGT</th>
            <th className="px-3 py-2.5 font-semibold">UTCI</th>
            <th className="px-3 py-2.5 font-semibold">Human Risk</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day_label} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5 font-semibold text-slate-900">
                {d.day_label}
                <span className="block text-[10px] font-normal text-slate-400">{d.date}</span>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-slate-700">{fmt.num(d.temp_max_c)} °C</td>
              <td className="px-3 py-2.5 tabular-nums text-slate-700">{fmt.num(d.humidity_mean_pct)} %</td>
              <td className="px-3 py-2.5 tabular-nums text-slate-700">{fmt.num(d.wind_speed_ms)} m/s</td>
              <td className="px-3 py-2.5 tabular-nums text-slate-700">
                {fmt.int(Math.round(d.solar_radiation_proxy))} W/m²
              </td>
              <td className="px-3 py-2.5 tabular-nums font-medium text-orange-700">
                {fmt.num(d.heat_index)} °C
              </td>
              <td className="px-3 py-2.5 tabular-nums font-medium text-red-700">{fmt.num(d.wbgt)} °C</td>
              <td className="px-3 py-2.5 tabular-nums text-slate-700">{fmt.num(d.utci)} °C</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {Math.round(d.risk_score)}
                  </span>
                  <RiskBadge level={d.risk_level} size="sm" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ForecastPage() {
  const { scenario, presentation } = useApp();
  const { data, loading, error } = useApiData(() => api.forecast(scenario), [scenario]);

  const chartData =
    data?.days.map((d) => ({
      name: d.day_label.replace("Day ", "D"),
      risk: Math.round(d.risk_score),
      temp: d.temp_max_c,
    })) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Forecast"
        title="5-Day Human Heat Risk Forecast"
        subtitle={
          <span>
            Risk is detected <strong>3–5 days before peak heat</strong> — the window in which early action
            is most effective. Demo scenario: <strong>{scenario}</strong>.
          </span>
        }
      />

      <Card
        title="Human Heat Risk Score — next 5 days"
        subtitle="Zones: 0–25 Low · 26–50 Moderate · 51–75 High · 76–100 Extreme (score from simulated demo weather)."
      >
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <RiskTrendChart days={data?.days ?? []} height={presentation ? 400 : 320} />
        )}
      </Card>

      <Card title="Temperature vs Human Heat Risk">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis
                yAxisId="risk"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="temp"
                orientation="right"
                domain={[30, 48]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="°C"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-slate-900">Day {label}</p>
                      {payload.map((p) => (
                        <p key={String(p.dataKey)} className="text-slate-600">
                          {p.dataKey === "risk" ? "Human risk" : "Max temp"}:{" "}
                          <span className="font-semibold text-slate-900">{String(p.value)}</span>
                          {p.dataKey === "temp" ? " °C" : ""}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="risk" dataKey="risk" radius={[4, 4, 0, 0]} barSize={26} fill="#1d4ed8" fillOpacity={0.25} />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temp"
                stroke="#ea580c"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#fff", stroke: "#ea580c", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Daily thermal metrics & risk" subtitle="All values are simulated demo forecast values.">
        {data ? (
          <MetricTable days={data.days} />
        ) : loading ? (
          <LoadingState />
        ) : (
          <ErrorState message={error ?? "No forecast"} />
        )}
      </Card>

      <DemoNotice
        text="Demo/synthetic forecast generated for the SIH26083 prototype. Not a meteorological forecast. WeatherProvider interface allows a real NWP API to be connected later."
      />
    </div>
  );
}