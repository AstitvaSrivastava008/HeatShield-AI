import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, FlaskConical, MonitorUp, UserRound, X } from "lucide-react";
import { useApp, SCENARIO_OPTIONS } from "@/context/AppContext";
import type { ScenarioId } from "@/services/types";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-slate-500">
      <CalendarClock className="h-3.5 w-3.5" />
      {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{" "}
      {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}

function ScenarioPicker() {
  const { scenario, setScenario } = useApp();
  const active = SCENARIO_OPTIONS.find((o) => o.id === scenario)!;
  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
        <FlaskConical className="h-3.5 w-3.5 text-blue-700" />
        Demo Mode
        <span className="text-slate-400">·</span>
        {active.label}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <select
        aria-label="Demo scenario"
        value={scenario}
        onChange={(e) => setScenario(e.target.value as ScenarioId)}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        title="Switch demo scenario"
      >
        {SCENARIO_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Header() {
  const { presentation, setPresentation, backend, refreshBackend, setPersonalOpen } = useApp();

  useEffect(() => {
    if (!backend) refreshBackend();
    const t = setInterval(refreshBackend, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <p className="truncate text-sm font-bold tracking-wide text-slate-900">
          HeatShield <span className="text-blue-700">Command Center</span>
        </p>
        <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 lg:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Simulated Data
        </span>
        <span
          className={`hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold md:inline-flex ${
            backend?.online
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          title={backend?.note ?? ""}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              backend?.online ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {backend?.checking ? "Checking API…" : backend?.online ? "API Online" : "API Offline"}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <Clock />
        <div className="hidden sm:block">
          <ScenarioPicker />
        </div>
        <button
          type="button"
          onClick={() => setPersonalOpen(true)}
          className="btn bg-blue-700 text-white hover:bg-blue-800"
          title="Get heatwave guidance personalised to your age, work and location"
        >
          <UserRound className="h-4 w-4" />
          My Heat Risk
        </button>
        <button
          type="button"
          onClick={() => setPresentation(!presentation)}
          className={`btn ${
            presentation ? "bg-blue-700 text-white hover:bg-blue-800" : "btn-secondary"
          }`}
          title="Presentation mode hides chrome and enlarges the dashboard"
        >
          {presentation ? <X className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          {presentation ? "Exit Presentation" : "Presentation"}
        </button>
      </div>
    </header>
  );
}