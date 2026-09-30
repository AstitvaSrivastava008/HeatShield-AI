import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { WardSummary } from "@/services/types";

/**
 * Ranked ward risk chart — horizontal bars, one per ward, coloured by risk.
 */
export default function WardRiskDistribution({
  wards,
  height = 320,
}: {
  wards: WardSummary[];
  height?: number;
}) {
  const data = [...wards]
    .sort((a, b) => b.risk_score - a.risk_score)
    .map((w) => ({
      name: w.ward_id.replace("W", "W "),
      score: Math.round(w.risk_score),
      ward: w.ward_id,
      level: w.risk_level,
      pop: w.population,
      color:
        w.risk_level === "EXTREME"
          ? "#dc2626"
          : w.risk_level === "HIGH"
            ? "#f97316"
            : w.risk_level === "MODERATE"
              ? "#f59e0b"
              : "#16a34a",
    }));

  if (!data.length) {
    return <div className="grid h-[260px] place-items-center text-sm text-slate-400">No ward data.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
        <YAxis
          type="category"
          dataKey="name"
          width={48}
          tick={{ fontSize: 12, fill: "#475569" }}
        />
        <Tooltip
          cursor={{ fill: "rgba(30,64,175,0.05)" }}
          content={({ active, payload }: { active?: boolean; payload?: any[] }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as {
              ward: string;
              score: number;
              level: string;
              pop: number;
            };
            return (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold text-slate-900">{row.ward}</p>
                <p className="font-bold text-slate-900">
                  Risk {row.score} <span className="font-medium text-slate-500">· {row.level}</span>
                </p>
                <p className="text-slate-500">Pop {row.pop.toLocaleString()} (demo)</p>
              </div>
            );
          }}
        />
        <ReferenceLine x={50} stroke="#cbd5e1" strokeDasharray="3 3" />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={14}>
          {data.map((d) => (
            <Cell key={d.ward} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}