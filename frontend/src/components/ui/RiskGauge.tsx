import { riskLevelFromScore } from "@/lib/risk";

/**
 * Segmented risk gauge (0-100) with LOW/MODERATE/HIGH/EXTREME zones.
 * Professional & readable on a projector.
 */
export default function RiskGauge({
  score,
  size = "md",
  showScale = true,
}: {
  score: number;
  size?: "md" | "lg";
  showScale?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  riskLevelFromScore(clamped);
  const zones = [
    { from: 0, to: 25, c: "#16a34a" },
    { from: 25, to: 50, c: "#f59e0b" },
    { from: 50, to: 75, c: "#f97316" },
    { from: 75, to: 100, c: "#dc2626" },
  ];

  return (
    <div className="w-full">
      <div className={`flex w-full overflow-hidden rounded-full bg-slate-100 ${size === "lg" ? "h-4" : "h-3"}`}>
        {zones.map((z) => {
          const start = (z.from / 100) * 100;
          const width = ((z.to - z.from) / 100) * 100;
          const active = clamped >= z.from && clamped <= z.to;
          return (
            <div
              key={z.from}
              className="relative"
              style={{ width: `${width}%`, marginLeft: start === 0 ? 0 : undefined }}
            >
              <div
                className={`h-full transition-opacity ${active ? "opacity-100" : "opacity-35"}`}
                style={{ backgroundColor: z.c }}
              />
            </div>
          );
        })}
      </div>
      {showScale && (
        <div className="mt-1 flex w-full justify-between text-[10px] font-medium text-slate-400">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      )}
      <div className="sr-only">Risk score {clamped} out of 100</div>
    </div>
  );
}