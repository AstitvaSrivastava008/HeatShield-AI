/**
 * Global app state: active demo scenario, presentation mode, selected ward.
 *
 * Changing the scenario re-fetches every page (map, KPIs, forecast, alerts)
 * with one click via the backend `?scenario=` parameter.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ScenarioId } from "@/services/types";
import { api } from "@/services/api";

export const SCENARIO_OPTIONS: { id: ScenarioId; label: string; blurb: string }[] = [
  { id: "normal", label: "Normal Day", blurb: "Cooler baseline · lower relative risk" },
  { id: "high_heat", label: "High Heat", blurb: "Escalating heat · widespread high–extreme risk" },
  { id: "extreme_heat", label: "Extreme Heatwave", blurb: "+4.4 °C vs baseline · citywide extreme risk" },
  {
    id: "extreme_vulnerable",
    label: "Extreme Heat + Higher Vulnerability",
    blurb: "Extreme heat with elevated elderly & outdoor-worker exposure",
  },
];

interface AppState {
  scenario: ScenarioId;
  setScenario: (s: ScenarioId) => void;
  presentation: boolean;
  setPresentation: (v: boolean) => void;
  selectedWardId: string | null;
  setSelectedWardId: (w: string | null) => void;
  personalOpen: boolean;
  setPersonalOpen: (v: boolean) => void;
  backend: { online: boolean; checking: boolean; note: string } | null;
  refreshBackend: () => void;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ScenarioId>("extreme_heat");
  const [presentation, setPresentation] = useState(false);
  const [selectedWardId, setSelectedWardId] = useState<string | null>("W07");
  const [personalOpen, setPersonalOpen] = useState(false);
  const [backend, setBackend] = useState<AppState["backend"]>(null);

  const refreshBackend = useCallback(() => {
    setBackend((prev) => ({ online: false, checking: true, note: prev?.note ?? "" }));
    api
      .health()
      .then(() => setBackend({ online: true, checking: false, note: "Backend connected" }))
      .catch((e: unknown) =>
        setBackend({
          online: false,
          checking: false,
          note: e instanceof Error ? e.message : "Backend unreachable",
        })
      );
  }, []);

  const value = useMemo<AppState>(
    () => ({
      scenario,
      setScenario,
      presentation,
      setPresentation,
      selectedWardId,
      setSelectedWardId,
      personalOpen,
      setPersonalOpen,
      backend,
      refreshBackend,
    }),
    [scenario, presentation, selectedWardId, personalOpen, backend, refreshBackend]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}