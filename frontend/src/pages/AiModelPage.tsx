import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, Database, GaugeCircle, Info } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState, DemoNotice } from "@/components/ui/Feedback";
import DriverContribBar from "@/charts/DriverContribBar";
import { fmt, featureLabel } from "@/lib/risk";

export default function AiModelPage() {
  const { selectedWardId, setSelectedWardId, scenario } = useApp();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const w = params.get("ward");
    if (w) setSelectedWardId(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const allWards = useApiData(() => api.wards(scenario), [scenario]);
  const modelInfo = useApiData(() => api.modelInfo(), []);
  const detail = useApiData(
    () => (selectedWardId ? api.wardDetail(selectedWardId, scenario) : Promise.resolve(null)),
    [selectedWardId, scenario]
  );

  const wardOptions = allWards.data?.wards ?? [];

  const select = (id: string) => {
    setSelectedWardId(id);
    setParams({ ward: id }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="AI Risk Engine"
        title="Explainable Heat-Risk Machine Learning"
        subtitle="An XGBoost regressor trained on synthetic demo data predicts human heat risk; SHAP (or a labelled fallback) explains each ward's drivers."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card
            title="Model"
            subtitle={
              modelInfo.data
                ? `${modelInfo.data.model.replace(/-/g, " ")} · trained on ${fmt.int(modelInfo.data.n_samples)} synthetic samples`
                : "Loading model information…"
            }
          >
            {modelInfo.loading ? (
              <LoadingState />
            ) : modelInfo.error ? (
              <ErrorState message={modelInfo.error} />
            ) : modelInfo.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <p className="label">MAE (score pts)</p>
                    <p className="text-lg font-semibold tabular-nums text-slate-900">
                      {modelInfo.data.metrics?.mae_score_points ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <p className="label">R² (held-out)</p>
                    <p className="text-lg font-semibold tabular-nums text-slate-900">
                      {modelInfo.data.metrics?.r2 != null ? modelInfo.data.metrics.r2.toFixed(3) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <p className="label">Explainer</p>
                    <p className="text-lg font-semibold capitalize text-slate-900">
                      {modelInfo.data.explainer_available ? "SHAP" : "Feature importance"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <p className="label">Model</p>
                    <p className="text-lg font-semibold capitalize text-slate-900">{modelInfo.data.model}</p>
                  </div>
                </div>
                <div>
                  <p className="label mb-2">Risk thresholds</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {Object.entries(modelInfo.data.risk_levels ?? {}).map(([level, bounds]) => (
                      <div
                        key={level}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                          level === "EXTREME"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : level === "HIGH"
                              ? "border-orange-200 bg-orange-50 text-orange-700"
                              : level === "MODERATE"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-green-200 bg-green-50 text-green-700"
                        }`}
                      >
                        <span className="block text-sm font-bold">{bounds[0]}–{bounds[1]}</span>
                        {level}
                      </div>
                    ))}
                  </div>
                </div>
                <DemoNotice
                  compact
                  text="Prototype evaluation on synthetic demonstration data — does not represent real-world model accuracy."
                />
              </div>
            ) : null}
          </Card>

          <Card title="Model features" subtitle="Inputs used by the trained regressor.">
            <div className="flex flex-wrap gap-1.5">
              {modelInfo.data?.features?.map((f) => (
                <span key={f} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                  {featureLabel(f)}
                </span>
              )) ?? <LoadingState />}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {modelInfo.data?.confidence_definition ?? ""}
            </p>
          </Card>
        </div>

        <Card
          title="WHY IS THIS WARD AT RISK?"
          subtitle="Illustrative prototype model contribution — NOT scientific attribution."
          actions={
            <div className="relative">
              <select
                value={selectedWardId ?? ""}
                onChange={(e) => select(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                aria-label="Select ward"
              >
                {wardOptions.map((w) => (
                  <option key={w.ward_id} value={w.ward_id}>
                    {w.ward_name}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {detail.loading ? (
            <LoadingState label="Computing drivers…" />
          ) : detail.error ? (
            <ErrorState message={detail.error} />
          ) : detail.data?.explain?.contributions ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <span className="text-sm font-semibold text-slate-800">{detail.data.ward_name}</span>
                <span className="text-sm font-bold tabular-nums text-slate-900">
                  {Math.round(detail.data.risk_score)}
                  <span className="ml-1 text-xs font-medium text-slate-400">/100 · {detail.data.risk_level}</span>
                </span>
              </div>
              <DriverContribBar contributions={detail.data.explain.contributions} height={300} />
              <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-slate-600">
                <Brain className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                <p>
                  {detail.data.explain.explainer === "shap"
                    ? "Drivers computed with SHAP (explainer installed on this machine)."
                    : "Drivers computed with model feature importance + direction heuristic (SHAP not available)."}
                </p>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">{detail.data.explain.note}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Select a ward to inspect its risk drivers.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Endpoint">
          <p className="font-mono text-xs text-slate-700">POST /api/predict-risk</p>
          <p className="mt-1 text-xs text-slate-500">
            Weather + vulnerability features → risk score, level and prototype confidence.
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><GaugeCircle className="h-3.5 w-3.5" /> Confidence is (1 − MAE/100) on synthetic held-out data.</p>
        </Card>
        <Card title="Explainability">
          <p className="font-mono text-xs text-slate-700">/api/risk-drivers/{'{ward_id}'}</p>
          <p className="mt-1 text-xs text-slate-500">
            Returns per-ward contribution list. Fallback to model feature importance when SHAP is unavailable.
          </p>
        </Card>
        <Card title="Data & training">
          <p className="font-mono text-xs text-slate-700">backend/train_model.py</p>
          <p className="mt-1 text-xs text-slate-500">
            Generates synthetic data, trains XGBoost, saves the artifact for FastAPI. Artifact:{" "}
            <code className="rounded bg-slate-100 px-1">ml/artifacts/risk_model.json</code>.
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><Database className="h-3.5 w-3.5" /> Dataset stored in ml/dataset.py.</p>
        </Card>
      </div>
    </div>
  );
}