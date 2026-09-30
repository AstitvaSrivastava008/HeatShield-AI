import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import type { ForecastDay } from "@/services/types";

const ZONES = [
  { y1: 0, y2: 25, color: "#dcfce7", label: "Low" },
  { y1: 25, y2: 50, color: "#fef9c3", label: "Moderate" },
  { y1: 50, y2: 75, color: "#ffedd5", label: "High" },
  { y1: 75, y2: 100, color: "#fee2e2", label: "Extreme" },
];

export function riskChartData(days: ForecastDay[]) {
  return days.map((d) => ({
    name: d.day_label.replace("Day ", "D"),
    day: d.day_label,
    risk: Math.round(d.risk_score),
    temp: d.temp_max_c,
    level: d.risk_level,
  }));
}

export default function RiskTrendChart({
  days,
  height = 300,
  highlightPeak = true,
}: {
  days: ForecastDay[];
  height?: number;
  highlightPeak?: boolean;
}) {
  const data = riskChartData(days);
  if (!data.length) {
    return (
      <div className="grid h-[300px] place-items-center text-sm text-slate-400">
        No forecast data available.
      </div>
    );
  }
  const peak = data.reduce((a, b) => (b.risk > a.risk ? b : a), data[0]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
        <defs>
          <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
            <stop offset="60%" stopColor="#f97316" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        {ZONES.map((z) => (
          <ReferenceArea key={z.y1} y1={z.y1} y2={z.y2} fill={z.color} fillOpacity={0.55} />
        ))}
        <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Human Heat Risk", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
        />
        <Tooltip
          content={({ active, payload }: { active?: boolean; payload?: any[] }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { day: string; risk: number; temp: number; level: string };
            return (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                <p className="text-xs font-semibold text-slate-900">{row.day}</p>
                <p className="text-sm font-bold text-slate-900">
                  Risk {row.risk}
                  <span className="ml-1 text-[10px] font-semibold text-slate-500">{row.level}</span>
                </p>
                <p className="text-[11px] text-slate-500">Max temp {row.temp} °C</p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="risk"
          stroke="#dc2626"
          strokeWidth={2.5}
          fill="url(#riskFill)"
          dot={{ r: 4, fill: "#fff", stroke: "#dc2626", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
        {highlightPeak && (
          <ReferenceLine
            x={peak.name}
            stroke="#0f172a"
            strokeDasharray="4 3"
            label={{
              value: "Peak risk",
              position: "top",
              fill: "#0f172a",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}