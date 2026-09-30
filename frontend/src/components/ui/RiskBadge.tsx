import type { RiskLevel } from "@/services/types";
import { RISK_META } from "@/lib/risk";

export function RiskBadge({
  level,
  size = "md",
  className = "",
}: {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = RISK_META[level];
  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3.5 py-1.5 text-sm",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${meta.bg} ${meta.border} ${meta.text} ${sizes[size]} ${className}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
      {level}
    </span>
  );
}