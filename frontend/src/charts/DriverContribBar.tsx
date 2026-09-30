import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { featureLabel, featureUnit } from "@/lib/risk";
import type { Contribution } from "@/services/types";

/**
 * Horizontal contribution chart for risk drivers.
 * The values are labelled as illustrative prototype model contributions.
 */
export default function DriverContribBar({
  contributions,
  height = 220,
}: {
  contributions: Contribution[];
  height?: number;
}) {
  const data = useMemo(
    () =>
      [...contributions]
        .sort((a, b) => b.percent_contribution - a.percent_contribution)
        .slice(0, 8)
        .map((c) => ({
          name: featureLabel(c.feature),
          value: c.percent_contribution,
          raw: c.value.toFixed(2),
          unit: featureUnit(c.feature),
          up: c.direction !== "down",
          native: c.feature,
        })),
    [contributions]
  );

  if (!data.length) return <p className="text-sm text-slate-400">No contribution data.</p>;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 11, fill: "#475569" }}
        />
        <Tooltip
          cursor={{ fill: "rgba(30,64,175,0.05)" }}
          content={({ active, payload }: { active?: boolean; payload?: any[] }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0];
            const d = item?.payload as
              | { raw: string; unit: string; native: string; value: number }
              | undefined;
            if (!d) return null;
            return (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold text-slate-900">{featureLabel(d.native)}</p>
                <p className="text-sm font-bold text-blue-700">{d.value.toFixed(1)}% contribution</p>
                <p className="text-slate-500">
                  value {d.raw} {d.unit}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={16}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.up ? "#1d4ed8" : "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}