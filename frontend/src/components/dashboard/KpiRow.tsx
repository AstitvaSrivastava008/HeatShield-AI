import type { ReactNode } from "react";
import { Activity, AlertTriangle, MapPin, Users, CalendarRange } from "lucide-react";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { fmt } from "@/lib/risk";
import type { RiskLevel } from "@/services/types";

export interface Kpi {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  emphasis?: boolean;
}

function KpiCard({ kpi, big }: { kpi: Kpi; big: boolean }) {
  return (
    <div
      className={`card card-pad flex items-center gap-3 ${
        kpi.emphasis ? "border-blue-200 bg-blue-50/50 ring-1 ring-blue-100" : ""
      }`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-xl ${
          kpi.emphasis ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"
        } ${big ? "h-12 w-12" : "h-10 w-10"}`}
      >
        {kpi.icon}
      </span>
      <div className="min-w-0">
        <p className="label truncate">{kpi.label}</p>
        <div className={`truncate font-bold text-slate-900 ${big ? "text-2xl" : "text-xl"}`}>
          {kpi.value}
        </div>
        {kpi.sub && <p className="truncate text-[11px] text-slate-500">{kpi.sub}</p>}
      </div>
    </div>
  );
}

export function KpiRow({
  error,
  loading,
  currentRiskLevel,
  highestWardId,
  highestWardName,
  vulnerablePop,
  alertsCount,
}: {
  error: string | null;
  loading: boolean;
  currentRiskLevel: RiskLevel | null;
  highestWardId: string | null;
  highestWardName: string | null;
  vulnerablePop: number | null;
  alertsCount: number | null;
}) {
  if (loading || error) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card card-pad flex items-center gap-3">
            <span className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-2.5 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const kpis: Kpi[] = [
    {
      label: "Current Heat Risk",
      icon: <Activity className="h-5 w-5" />,
      value: currentRiskLevel ? <RiskBadge level={currentRiskLevel} size="lg" /> : "—",
      sub: "City-wide demo estimate",
      emphasis: true,
    },
    {
      label: "Highest-Risk Ward",
      icon: <MapPin className="h-5 w-5" />,
      value: highestWardId ?? "—",
      sub: highestWardName ?? "Demo",
    },
    {
      label: "Forecast Horizon",
      icon: <CalendarRange className="h-5 w-5" />,
      value: "3–5",
      sub: "Days ahead",
    },
    {
      label: "Vulnerable Population",
      icon: <Users className="h-5 w-5" />,
      value: vulnerablePop != null ? fmt.int(vulnerablePop) : "—",
      sub: "Demo estimate",
    },
    {
      label: "Active Alerts",
      icon: <AlertTriangle className="h-5 w-5" />,
      value: alertsCount != null ? String(alertsCount) : "—",
      sub: "Wards requiring action",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} big />
      ))}
    </div>
  );
}