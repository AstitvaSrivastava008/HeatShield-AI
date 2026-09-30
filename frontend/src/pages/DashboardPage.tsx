import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, SCENARIO_OPTIONS } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState, DemoNotice } from "@/components/ui/Feedback";
import { KpiRow } from "@/components/dashboard/KpiRow";
import RiskTrendChart from "@/charts/RiskTrendChart";
import WardRiskDistribution from "@/charts/WardRiskDistribution";
import WhoWhereWhy from "@/components/dashboard/WhoWhereWhy";
import { ActionEngine } from "@/components/dashboard/ActionEngine";
import AlertList from "@/components/alerts/AlertList";
import WardMap from "@/components/map/WardMap";
import WardDetailPanel from "@/components/map/WardDetailPanel";
import ScenarioSimulator from "@/components/scenario/ScenarioSimulator";
import { computeSummary } from "@/lib/summary";

export default function DashboardPage() {
  const { scenario, setScenario, presentation } = useApp();
  const navigate = useNavigate();

  const wards = useApiData(() => api.wards(scenario), [scenario]);
  const forecast = useApiData(() => api.forecast(scenario), [scenario]);
  const alerts = useApiData(() => api.alerts(scenario), [scenario]);

  if (presentation) {
    return <PresentationDashboard />;
  }

  const summary = wards.data ? computeSummary(wards.data.wards) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Command Dashboard"
        title="HeatShield Command Center"
        subtitle={
          <span>
            From weather forecasting to <strong className="text-slate-700">human risk forecasting</strong>.
            Local early-warning decision support for the demo city.
          </span>
        }
        actions={
          <div className="hidden items-center gap-2 md:flex">
            <DemoNotice
              compact
              text="All figures are simulated demo data (SIH26083)."
            />
          </div>
        }
      />

      {/* 1. What is happening? */}
      <KpiRow
        error={wards.error}
        loading={wards.loading}
        currentRiskLevel={summary?.current_risk_level ?? null}
        highestWardId={summary?.highest_risk_ward ?? null}
        highestWardName={summary?.highest_risk_ward_name ?? null}
        vulnerablePop={summary?.vulnerable_population_demo_estimate ?? null}
        alertsCount={summary?.active_alerts ?? null}
      />

      {/* 2. Where is it happening? */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3">
            <p className="label text-blue-700">Where is it happening?</p>
            <h2 className="text-base font-bold text-slate-900">
              Ward-level heat risk map
            </h2>
            <p className="text-xs text-slate-500">
              Click any ward to inspect risk drivers, vulnerable population and recommended action.
            </p>
          </div>
          {wards.error ? (
            <ErrorState message={wards.error} />
          ) : (
            <WardMap
              wards={wards.data?.wards ?? []}
              loading={wards.loading}
              error={wards.error}
              minHeight={presentation ? 620 : 470}
            />
          )}
        </div>
        <div className="space-y-4">
          <WardDetailPanel />
        </div>
      </div>

      {/* 3. 5-day risk trend */}
      <Card
        title="Forecast: human heat risk, next 5 days"
        subtitle="Risk begins increasing 3–5 days before the peak."
        actions={
          <button type="button" className="btn-secondary" onClick={() => navigate("/forecast")}>
            Full forecast
          </button>
        }
      >
        {forecast.loading ? (
          <LoadingState />
        ) : forecast.error ? (
          <ErrorState message={forecast.error} />
        ) : (
          <RiskTrendChart days={forecast.data?.days ?? []} height={280} />
        )}
      </Card>

      {/* WHO / WHERE / WHY */}
      <WhoWhereWhy />

      {/* Action engine + alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="AI Heat Action Engine" subtitle="What should authorities do?">
          {summary ? (
            <ActionEngine riskLevel={summary.current_risk_level} />
          ) : (
            <LoadingState />
          )}
        </Card>
        <Card
          title="Active alerts"
          subtitle="Prototype alerts generated from simulated risk."
          actions={
            <button type="button" className="btn-secondary" onClick={() => navigate("/alerts")}>
              Alert center
            </button>
          }
        >
          {alerts.loading ? (
            <LoadingState />
          ) : alerts.error ? (
            <ErrorState message={alerts.error} />
          ) : (
            <AlertList alerts={alerts.data?.alerts ?? []} limit={6} />
          )}
        </Card>
      </div>

      {/* Ward risk distribution */}
      <Card title="Ward risk distribution">
        {wards.loading ? (
          <LoadingState />
        ) : (
          <WardRiskDistribution wards={wards.data?.wards ?? []} />
        )}
      </Card>

      {/* Scenario simulator */}
      <div>
        <div className="mb-3">
          <p className="label text-blue-700">Live simulation</p>
          <h2 className="text-base font-bold text-slate-900">Heat Scenario Simulator</h2>
          <p className="text-xs text-slate-500">
            Asked by judges: “What happens if temperature increases by 2 °C?” — show them live.
          </p>
        </div>
        <ScenarioSimulator embedded />
      </div>

      {/* Scenario strip */}
      <div className="card card-pad">
        <div className="mb-2 flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-700" />
          <p className="text-sm font-bold text-slate-900">Demo scenario</p>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          One click re-computes the map, KPIs, forecast and alerts for the chosen synthetic scenario.
        </p>
        <div className="flex flex-wrap gap-2">
          {SCENARIO_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn ${scenario === opt.id ? "bg-blue-700 text-white hover:bg-blue-800" : "btn-secondary"}`}
              title={opt.blurb}
              onClick={() => setScenario(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Simplified, enlarged view for presentations/projection. */
function PresentationDashboard() {
  const { scenario } = useApp();
  const wards = useApiData(() => api.wards(scenario), [scenario]);
  const forecast = useApiData(() => api.forecast(scenario), [scenario]);
  const summary = wards.data ? computeSummary(wards.data.wards) : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="label text-blue-700">HEATSHIELD AI · Demo Scenario “{scenario}”</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          HeatShield Command Center
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          From weather forecasting to human risk forecasting — simulated demo data.
        </p>
      </div>
      <KpiRow
        error={wards.error}
        loading={wards.loading}
        currentRiskLevel={summary?.current_risk_level ?? null}
        highestWardId={summary?.highest_risk_ward ?? null}
        highestWardName={summary?.highest_risk_ward_name ?? null}
        vulnerablePop={summary?.vulnerable_population_demo_estimate ?? null}
        alertsCount={summary?.active_alerts ?? null}
      />
      <WardMap
        wards={wards.data?.wards ?? []}
        loading={wards.loading}
        error={wards.error}
        minHeight={560}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="5-day human risk">
          {forecast.error ? (
            <ErrorState message={forecast.error} />
          ) : (
            <RiskTrendChart days={forecast.data?.days ?? []} height={260} />
          )}
        </Card>
        <Card title="Ward risk distribution">
          <WardRiskDistribution wards={wards.data?.wards ?? []} height={260} />
        </Card>
        <Card title="What should authorities do?">
          {summary ? (
            <ActionEngine riskLevel={summary.current_risk_level} />
          ) : (
            <LoadingState />
          )}
        </Card>
      </div>
    </div>
  );
}