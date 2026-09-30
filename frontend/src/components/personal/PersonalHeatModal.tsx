/**
 * "My Heat Risk" - personalised heatwave self-assessment modal.
 *
 * Privacy contract (see lib/personal.ts for the full rationale): the browser
 * location API is read once and discarded, coordinates never reach the backend
 * or storage, and age is a coarse band rather than a date of birth. The only
 * values transmitted are the selected ward's public aggregate weather and two
 * anonymous 0-1 vulnerability ratios that the existing model already consumes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Crosshair,
  Droplets,
  Loader2,
  MapPin,
  ShieldCheck,
  Thermometer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  AGE_BANDS,
  EMPTY_PROFILE,
  WORK_TYPES,
  ageBand,
  assessPersonal,
  clearProfile,
  haversineKm,
  loadProfile,
  matchWard,
  personalGuidance,
  requestPosition,
  saveProfile,
} from "@/lib/personal";
import type { PersonalAssessment, PersonalProfile, WorkTypeId } from "@/lib/personal";
import { RISK_META, fmt, riskLevelFromScore } from "@/lib/risk";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { useApp } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/services/api";
import type { PredictResponse, WardSummary } from "@/services/types";

interface Props {
  open: boolean;
  onClose: () => void;
  wards: WardSummary[];
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        checked
          ? "border-blue-300 bg-blue-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-slate-900">{label}</span>
        <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>
      </span>
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors ${
        active
          ? "border-blue-700 bg-blue-700 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function PersonalHeatModal({ open, onClose, wards }: Props) {
  const [profile, setProfile] = useState<PersonalProfile>(EMPTY_PROFILE);
  const [remember, setRemember] = useState(false);
  const [geoState, setGeoState] = useState<
    { status: "idle" | "busy" | "error"; message?: string }
  >({ status: "idle" });
  const [result, setResult] = useState<
    | { status: "busy" }
    | { status: "error"; message: string }
    | { status: "ok"; data: PredictResponse; assessment: PersonalAssessment }
  >({ status: "busy" });
  const [didAutoRun, setDidAutoRun] = useState(false);

  // Reset each time the modal opens, restoring an opted-in remembered profile.
  useEffect(() => {
    if (!open) return;
    const saved = loadProfile();
    setProfile(saved ?? EMPTY_PROFILE);
    setRemember(saved != null);
    setResult({ status: "busy" });
    setDidAutoRun(false);
    setGeoState({ status: "idle" });
  }, [open]);

  const set = useCallback(<K extends keyof PersonalProfile>(key: K, value: PersonalProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setDidAutoRun(false);
  }, []);

  const ward = useMemo(
    () => (profile.wardId ? wards.find((w) => w.ward_id === profile.wardId) ?? null : null),
    [profile.wardId, wards]
  );

  const run = useCallback(async () => {
    if (!ward) return;
    setResult({ status: "busy" });
    try {
      // The only network call: the ward's public aggregate weather plus two
      // anonymous ratios. The user's coordinates are not part of this payload.
      const data = await api.predictRisk({
        temperature: ward.temperature,
        humidity: ward.humidity,
        wind_speed: ward.wind_speed,
        solar_radiation: ward.solar_radiation,
        elderly_density: ageBand(profile.ageBand).elderlyDensity,
        outdoor_worker_density:
          WORK_TYPES.find((w) => w.id === profile.workType)?.outdoorWorkerDensity ?? 0.08,
        population_density: ward.population_density_index,
      });
      setResult({ status: "ok", data, assessment: assessPersonal(data.risk_score, ward, profile) });
    } catch (e) {
      setResult({
        status: "error",
        message: e instanceof Error ? e.message : "Could not reach the risk engine.",
      });
    }
  }, [ward, profile]);

  // Re-run automatically the first time enough is known, so the modal shows a
  // result instead of making the user press a second button.
  useEffect(() => {
    if (!open || didAutoRun || !ward) return;
    setDidAutoRun(true);
    void run();
  }, [open, didAutoRun, ward, run]);

  const locate = useCallback(async () => {
    setGeoState({ status: "busy" });
    try {
      const pos = await requestPosition();
      const match = matchWard(wards, pos.coords.latitude, pos.coords.longitude);
      if (!match) {
        setGeoState({ status: "error", message: "No ward data loaded yet. Please retry." });
        return;
      }
      setProfile((p) => ({
        ...p,
        wardId: match.ward.ward_id,
        locationSource: "gps",
        distanceKm: match.ward.centroid
          ? haversineKm(pos.coords.latitude, pos.coords.longitude, match.ward.centroid[1], match.ward.centroid[0])
          : null,
      }));
      setDidAutoRun(false);
      setGeoState({ status: "idle" });
    } catch (e) {
      setGeoState({
        status: "error",
        message: e instanceof Error ? e.message : "Location unavailable.",
      });
    }
  }, [wards]);

  const onRemember = useCallback(
    (v: boolean) => {
      setRemember(v);
      if (v) saveProfile(profile);
      else clearProfile();
    },
    [profile]
  );

  // Keep the saved copy in step with the toggles once persistence is enabled.
  useEffect(() => {
    if (remember) saveProfile(profile);
  }, [remember, profile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const band = ageBand(profile.ageBand);
  const work = WORK_TYPES.find((w) => w.id === profile.workType)!;
  const assessment = result.status === "ok" ? result.assessment : null;
  const guidance = assessment && result.status === "ok" ? personalGuidance(assessment, result.assessment.level) : null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="My personal heat risk"
    >
      <div className="my-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UserRound className="h-4.5 w-4.5 text-blue-700" />
              My Personal Heat Risk
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Personalised heatwave guidance for <span className="font-semibold">you</span>, not a
              ward average.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-0 md:grid-cols-2">
          {/* ---------------------------- inputs ---------------------------- */}
          <div className="space-y-4 border-b border-slate-100 px-5 py-4 md:border-b-0 md:border-r">
            <section>
              <p className="label mb-2">1. Your age group</p>
              <div className="flex flex-wrap gap-1.5">
                {AGE_BANDS.map((b) => (
                  <Chip key={b.id} active={b.id === profile.ageBand} onClick={() => set("ageBand", b.id)}>
                    {b.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-500">{band.note}</p>
            </section>

            <section>
              <p className="label mb-2">2. What kind of work do you do?</p>
              <div className="grid gap-1.5">
                {WORK_TYPES.map((w) => (
                  <Chip
                    key={w.id}
                    active={w.id === profile.workType}
                    onClick={() => set("workType", w.id as WorkTypeId)}
                  >
                    {w.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-500">{work.note}</p>
            </section>

            <section>
              <p className="label mb-2">3. Where are you right now?</p>
              <button
                type="button"
                onClick={locate}
                disabled={geoState.status === "busy"}
                className="btn w-full justify-center bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {geoState.status === "busy" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crosshair className="h-4 w-4" />
                )}
                {geoState.status === "busy" ? "Locating…" : "Use my current location"}
              </button>

              <div className="my-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                or pick your ward
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <select
                aria-label="Select your ward"
                value={profile.wardId ?? ""}
                onChange={(e) => {
                  setProfile((p) => ({
                    ...p,
                    wardId: e.target.value || null,
                    locationSource: e.target.value ? "manual" : null,
                    distanceKm: null,
                  }));
                  setDidAutoRun(false);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-800"
              >
                <option value="">Select your ward…</option>
                {wards.map((w) => (
                  <option key={w.ward_id} value={w.ward_id}>
                    {w.ward_name}
                  </option>
                ))}
              </select>

              {geoState.status === "error" && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {geoState.message}
                </p>
              )}
              {ward && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  Matched to <span className="font-semibold text-slate-800">{ward.ward_name}</span>
                  {profile.locationSource === "gps" && profile.distanceKm != null && (
                    <span className="text-slate-400">
                      (nearest centroid {fmt.num(profile.distanceKm)} km away)
                    </span>
                  )}
                </p>
              )}
            </section>

            <section>
              <p className="label mb-2">4. Your situation today</p>
              <div className="space-y-1.5">
                <Toggle
                  checked={profile.cooledAccess}
                  onChange={(v) => set("cooledAccess", v)}
                  label="I can reach a cooled or shaded place quickly"
                  hint="Air-conditioned room, shaded veranda, covered shelter within a few minutes"
                />
                <Toggle
                  checked={profile.headCover}
                  onChange={(v) => set("headCover", v)}
                  label="I have head / shoulder cover for sun"
                  hint="Wide-brim hat, cloth wrap, umbrella or cap"
                />
                <Toggle
                  checked={profile.hydrates}
                  onChange={(v) => set("hydrates", v)}
                  label="I drink water regularly through the day"
                  hint="Not just when I feel thirsty"
                />
                <Toggle
                  checked={profile.healthSensitive}
                  onChange={(v) => set("healthSensitive", v)}
                  label="Heat-sensitive health condition or medication"
                  hint="Heart or respiratory or kidney condition, or medicines affecting fluid balance"
                />
              </div>
            </section>
          </div>

          {/* ---------------------------- result ---------------------------- */}
          <div className="space-y-4 px-5 py-4">
            {!ward && (
              <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
                <div>
                  <MapPin className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    Choose your ward to get started
                  </p>
                  <p className="mx-auto mt-1 max-w-[34ch] text-xs text-slate-500">
                    Use your current location, or pick your ward from the list. Your coordinates
                    stay on this device.
                  </p>
                </div>
              </div>
            )}

            {ward && result.status === "busy" && (
              <div className="grid min-h-[220px] place-items-center rounded-xl border border-slate-200 bg-slate-50/60">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-700" />
                  <p className="text-sm text-slate-600">Assessing your heat risk…</p>
                </div>
              </div>
            )}

            {ward && result.status === "error" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Assessment failed</p>
                <p className="mt-1 text-xs text-red-700">{result.message}</p>
                <button type="button" onClick={() => void run()} className="btn-secondary mt-3">
                  Retry
                </button>
              </div>
            )}

            {ward && assessment && guidance && result.status === "ok" && (
              <>
                <div
                  className={`rounded-xl border p-4 ${
                    RISK_META[assessment.level].bg
                  } ${RISK_META[assessment.level].border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Your personal heat risk
                      </p>
                      <p
                        className="mt-1 text-3xl font-bold tabular-nums"
                        style={{ color: RISK_META[assessment.level].color }}
                      >
                        {Math.round(assessment.score)}
                        <span className="text-base font-medium text-slate-400">/100</span>
                      </p>
                      <RiskBadge level={assessment.level} className="mt-1.5" />
                    </div>
                    <div className="text-right text-[11px] leading-relaxed text-slate-600">
                      <p className="font-semibold text-slate-700">{guidance.band}</p>
                      <p className="mt-0.5">Model {Math.round(assessment.modelScore)}</p>
                      <p className={assessment.modifier > 0 ? "text-orange-600" : "text-slate-500"}>
                        {assessment.modifier > 0 ? "+" : ""}
                        {assessment.modifier} exposure adj.
                      </p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-700">
                    {guidance.bandText}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["Air temp", `${fmt.num(ward.temperature)} °C`, Thermometer],
                      ["Humidity", `${Math.round(ward.humidity)}%`, Droplets],
                      ["WBGT", `${fmt.num(ward.wbgt)} °C`, Activity],
                      ["Heat index", `${fmt.num(ward.heat_index)} °C`, Thermometer],
                    ] as const
                  ).map(([label, value, Icon]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                        <Icon className="h-3 w-3" />
                        {label}
                      </p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                {assessment.modifiers.length > 0 && (
                  <details className="rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
                      How your exposure adjusted this score (+{assessment.modifier})
                    </summary>
                    <ul className="space-y-1.5 border-t border-slate-100 px-3 py-2">
                      {assessment.modifiers.map((m) => (
                        <li key={m.label} className="text-[11px] leading-snug">
                          <span className="font-semibold text-orange-600">+{m.delta}</span>{" "}
                          <span className="font-semibold text-slate-800">{m.label}</span>
                          <span className="text-slate-500"> — {m.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div>
                  <p className="label mb-1.5">What to do for you</p>
                  <ul className="space-y-1.5">
                    {guidance.actions.map((a) => (
                      <li key={a} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-red-200 bg-red-50/70 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Get help if you notice
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {guidance.redFlags.map((r) => (
                      <li key={r} className="text-[11px] leading-relaxed text-red-700">
                        · {r}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-[11px] text-slate-500">
                  {guidance.coolingSitesNote} Ward risk {Math.round(ward.risk_score)}/100 ·{" "}
                  {riskLevelFromScore(ward.risk_score)}.
                </p>

                <div className="flex gap-2">
                  <button type="button" onClick={() => void run()} className="btn-secondary flex-1 justify-center">
                    Re-assess
                  </button>
                  <button
                    type="button"
                    onClick={() => set("wardId", null)}
                    className="btn-ghost"
                    title="Clear this assessment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---------------------------- privacy ---------------------------- */}
        <footer className="space-y-2.5 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Your data stays with you. </span>
              Your location is read once by your browser and matched to a ward on this device, then
              discarded — it is never stored and never sent to our servers. We only send the
              chosen ward&rsquo;s public weather figures and two anonymous risk ratios (age band and
              work type). No name, no account, no history.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => onRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Remember my age group and work type on this device (no location)
            </label>
            {remember && (
              <button
                type="button"
                onClick={() => {
                  clearProfile();
                  setRemember(false);
                }}
                className="text-[11px] font-semibold text-blue-700 underline"
              >
                Forget my details
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Data-loading wrapper. Mounted only while the modal is open, so the ward
 * lookup is not paid for on every page of the dashboard.
 */
export function PersonalHeatModalHost({ onClose }: { onClose: () => void }) {
  const { scenario } = useApp();
  const { data, error } = useApiData(() => api.wards(scenario), [scenario]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/50 p-6">
        <div className="max-w-sm rounded-xl border border-red-200 bg-white p-5 text-center shadow-xl">
          <p className="text-sm font-semibold text-red-800">Could not load ward data</p>
          <p className="mt-1 text-xs text-slate-600">{error}</p>
          <button type="button" onClick={onClose} className="btn-secondary mt-4">
            Close
          </button>
        </div>
      </div>
    );
  }

  return <PersonalHeatModal open onClose={onClose} wards={data?.wards ?? []} />;
}
