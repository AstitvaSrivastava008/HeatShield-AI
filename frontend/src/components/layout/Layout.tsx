import { Outlet } from "react-router-dom";
import { Info } from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
import { useApp } from "@/context/AppContext";
import { useApiData } from "@/hooks/useApiData";
import { PersonalHeatModalHost } from "@/components/personal/PersonalHeatModal";
import { api } from "@/services/api";

export function ScenarioNote() {
  const { scenario, backend } = useApp();
  const { data: health } = useApiData(() => api.health(), []);
  const note =
    health?.note ??
    "All HEATSHIELD AI prototype responses derive from simulated demo data. Not real-world measurements.";
  if (!backend?.online) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-sm">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
      <p>
        <span className="font-semibold text-slate-700">Demo scenario: </span>
        {note} Scenario “{scenario}”.
      </p>
    </div>
  );
}

export default function Layout() {
  const { presentation, personalOpen, setPersonalOpen } = useApp();
  return (
    <div
      className={`flex h-screen w-full overflow-hidden bg-slate-50 ${
        presentation ? "text-[17px]" : "text-[15px]"
      }`}
    >
      <Sidebar collapsed={presentation}>
        <p className="text-[10px] leading-relaxed text-slate-400">
          Local prototype · synthetic demo data · SIH26083
        </p>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto nice-scroll">
          <div
            className={`mx-auto w-full ${
              presentation ? "max-w-[1700px] px-6 py-5" : "max-w-[1500px] px-4 py-4 sm:px-5"
            }`}
          >
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>

      {personalOpen && <PersonalHeatModalHost onClose={() => setPersonalOpen(false)} />}
    </div>
  );
}