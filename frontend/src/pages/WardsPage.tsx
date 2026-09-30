import { useApp } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DemoNotice, LoadingState, ErrorState } from "@/components/ui/Feedback";
import WardMap from "@/components/map/WardMap";
import WardDetailPanel from "@/components/map/WardDetailPanel";
import WardRiskDistribution from "@/charts/WardRiskDistribution";

export default function WardsPage() {
  const { scenario, presentation, setSelectedWardId } = useApp();
  const { data, loading, error } = useApiData(() => api.wards(scenario), [scenario]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Risk Map"
        title="Ward-Level Heat Risk"
        subtitle="Simulated GeoJSON ward boundaries for the demo city. Click a ward to open risk detail, drivers and recommended action."
        actions={<DemoNotice compact text="Ward boundaries & risk are simulated demo data." />}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {error ? (
            <ErrorState message={error} />
          ) : (
            <WardMap
              wards={data?.wards ?? []}
              loading={loading}
              error={error}
              minHeight={presentation ? 640 : 540}
            />
          )}
        </div>
        <WardDetailPanel />
      </div>

      <Card title="Risk distribution across wards" subtitle="Ranked by prototype risk score (simulated).">
        <WardRiskDistribution wards={data?.wards ?? []} height={360} />
      </Card>

      <div className="card card-pad">
        <p className="label mb-3">All wards</p>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.wards.map((w) => (
              <button
                key={w.ward_id}
                type="button"
                className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                onClick={() => setSelectedWardId(w.ward_id)}
              >
                <p className="text-sm font-semibold text-slate-900">{w.ward_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Risk {Math.round(w.risk_score)}/100 · {w.risk_level} · WBGT {w.wbgt} °C
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}