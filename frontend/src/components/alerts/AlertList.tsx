import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { RiskBadge } from "@/components/ui/RiskBadge";
import type { AlertItem } from "@/services/types";

const SEVERITY_BAR: Record<string, string> = {
  EXTREME: "bg-red-500",
  HIGH: "bg-orange-500",
  MODERATE: "bg-amber-500",
  LOW: "bg-green-500",
};

export default function AlertList({
  alerts,
  limit,
  onSelectWard,
}: {
  alerts: AlertItem[];
  limit?: number;
  onSelectWard?: (wardId: string) => void;
}) {
  const navigate = useNavigate();
  const rows = limit ? alerts.slice(0, limit) : alerts;
  if (!rows.length)
    return <p className="py-6 text-center text-sm text-slate-400">No active alerts in this scenario.</p>;

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((a) => (
        <li key={a.id} className="flex gap-3 px-1 py-3">
          <span className={`mt-1.5 h-8 w-1 shrink-0 rounded-full ${SEVERITY_BAR[a.severity]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <RiskBadge level={a.severity} size="sm" />
              <p className="truncate text-sm font-semibold text-slate-900">{a.ward_name}</p>
              <span className="text-[10px] text-slate-400">{Math.round(a.risk_score)}/100</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{a.message}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              <button
                type="button"
                className="font-medium text-blue-700 hover:underline"
                onClick={() => {
                  if (onSelectWard) onSelectWard(a.ward_id);
                  navigate("/wards");
                }}
              >
                View ward
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                className="font-medium text-blue-700 hover:underline"
                onClick={() => navigate(`/ai-model?ward=${a.ward_id}`)}
              >
                View drivers
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                className="font-medium text-blue-700 hover:underline"
                onClick={() => navigate("/alerts")}
              >
                Recommended actions <ChevronRight className="inline h-3 w-3" />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}