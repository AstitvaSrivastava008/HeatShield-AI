import { ListChecks, ShieldCheck } from "lucide-react";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import { LoadingState, ErrorState } from "@/components/ui/Feedback";
import type { RiskLevel } from "@/services/types";
import { useEffect, useState } from "react";

/** AI Heat Action Engine - converts a risk level into recommended actions. */
export function ActionEngine({ riskLevel }: { riskLevel: RiskLevel }) {
  const [fallback, setFallback] = useState<{ level: string; heading: string; actions: string[] } | null>(null);
  const { data, loading, error } = useApiData(() => api.recommendations(riskLevel), [riskLevel]);

  useEffect(() => {
    if (data) setFallback(null);
  }, [data]);

  if (loading && !data && !fallback) return <LoadingState label="Loading recommended actions…" />;
  if (error && !fallback)
    return <ErrorState message={`${error}. Using local fallback table.`} />;
  if (!data && !fallback) return null;

  const rec = data ?? fallback!;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700">
            <ListChecks className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">{rec.heading}</p>
            <p className="text-[11px] text-slate-500">Risk level: {rec.level}</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {rec.actions.map((a: string) => (
          <li key={a} className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            {a}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">
        Prototype Recommended Actions — decision support for human authorities, not automatic control of
        infrastructure.
      </p>
    </div>
  );
}