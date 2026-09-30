import type { ReactNode } from "react";
import { LayoutDashboard, Map, TrendingUp, Thermometer, Brain, Bell } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Shield } from "lucide-react";
import { useApp } from "@/context/AppContext";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/wards", label: "Risk Map", icon: Map },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/thermal-engine", label: "Thermal Engine", icon: Thermometer },
  { to: "/ai-model", label: "AI Risk", icon: Brain },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-700 text-white shadow-sm">
        <Shield className="h-5 w-5" />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-wide text-slate-900">HEATSHIELD AI</p>
          <p className="text-[10px] font-medium text-slate-500">
            Heat Risk Command
          </p>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  children,
  collapsed,
}: {
  children: ReactNode;
  collapsed: boolean;
}) {
  const { setSelectedWardId } = useApp();
  return (
    <aside
      className={`flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`flex h-14 items-center border-b border-slate-100 px-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <NavLink to="/dashboard" onClick={() => setSelectedWardId(null)} title="HEATSHIELD AI">
          <Brand compact={collapsed} />
        </NavLink>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5 nice-scroll">
        {collapsed ? (
          NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSelectedWardId(null)}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center justify-center rounded-lg px-2 py-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 ${
                  isActive ? "bg-blue-50 text-blue-700" : ""
                }`
              }
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          ))
        ) : (
          NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSelectedWardId(null)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 ${
                  isActive ? "bg-blue-50 font-semibold text-blue-700" : ""
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))
        )}
      </nav>
      <div className={`border-t border-slate-100 p-3 ${collapsed ? "hidden" : ""}`}>
        {children}
      </div>
    </aside>
  );
}