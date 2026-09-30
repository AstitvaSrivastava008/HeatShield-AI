import { useNavigate } from "react-router-dom";
import { Bell, ShieldAlert } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { DemoNotice, LoadingState, ErrorState } from "@/components/ui/Feedback";
import type { RiskLevel } from "@/services/types";

export default function AlertsPage() {
  const { scenario, setSelectedWardId } = useApp();
  const navigate = useNavigate();
  const alerts = useApiData(() => api.alerts(scenario), [scenario]);

  const count = (lvl: RiskLevel) =>
    (alerts.data?.alerts ?? []).filter((a) => a.severity === lvl).length;

  const viewWard = (wardId: string) => {
    setSelectedWardId(wardId);
    navigate("/wards");
  };
  const viewDrivers = (wardId: string) => navigate(`/ai-model?ward=${wardId}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Alert Center"
        title="Heat Alerts"
        subtitle={`Prototype-generated alerts from simulated risk for scenario “${scenario}”. Not official government alerts.`}
        actions={
          <DemoNotice
            compact
            text={
              alerts.error
                ? "Backend unavailable"
                : `${count("EXTREME")} extreme · ${count("HIGH")} high · ${count("MODERATE")} moderate`
            }
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Active alerts" subtitle="Sorted most-severe first. Each alert can be drilled into.">
            {alerts.loading ? (
              <LoadingState />
            ) : alerts.error ? (
              <ErrorState message={alerts.error} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {(alerts.data?.alerts ?? []).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start gap-3 py-3.5">
                    <span
                      className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        a.severity === "EXTREME"
                          ? "bg-red-50 text-red-600"
                          : a.severity === "HIGH"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <RiskBadge level={a.severity} />
                        <p className="text-sm font-bold text-slate-900">{a.ward_name}</p>
                        <span className="text-[11px] text-slate-400">risk {Math.round(a.risk_score)}/100</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{a.message}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary" onClick={() => viewWard(a.ward_id)}>
                          View Ward
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => viewDrivers(a.ward_id)}>
                          View Drivers
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => navigate("/dashboard")}
                        >
                          Recommended Actions
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-300">{a.timestamp}</span>
                  </li>
                ))}
                {!alerts.data?.alerts?.length && !alerts.loading && (
                  <li className="py-6 text-center text-sm text-slate-400">No alerts for this scenario.</li>
                )}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Action matrix" subtitle="Prototype Recommended Actions per risk level.">
            <div className="space-y-3">
              {(
                [
                  ["EXTREME", "Activate cooling centres · public alert · hospital prep · shift outdoor hours"],
                  ["HIGH", "Increase monitoring · worker advisory · pre-position healthcare"],
                  ["MODERATE", "Public awareness notification · monitor forecast"],
                  ["LOW", "Routine monitoring"],
                ] as [RiskLevel, string][]
              ).map(([lvl, text]) => (
                <div key={lvl} className="rounded-lg border border-slate-200 p-3">
                  <RiskBadge level={lvl} size="sm" />
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{text}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Decision support for human authorities, not automatic control of infrastructure.
            </p>
          </Card>

          <Card
            title="Ward summary"
            actions={
              <button type="button" className="btn-ghost -mr-1 text-xs" onClick={() => navigate("/wards")}>
                Open map
              </button>
            }
          >
            <div className="space-y-1.5">
              {(alerts.data?.alerts ?? []).slice(0, 4).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => viewWard(a.ward_id)}
                >
                  <span className="truncate text-xs font-semibold text-slate-800">{a.ward_name}</span>
                  <span className="shrink-0 text-[10px] font-medium uppercase text-slate-400">
                    {a.severity}
                  </span>
                </button>
              ))}
              {!alerts.data?.alerts?.length && (
                <p className="text-xs text-slate-400">No wards in alert.</p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">See the Risk Map page for full ward details.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}