import { Users, Map as MapIcon, AlertTriangle } from "lucide-react";

const WHO = [
  { title: "Elderly residents", desc: "Reduced thermoregulation & higher co-morbidity risk." },
  { title: "Outdoor workers", desc: "Sustained WBGT exposure through peak hours." },
  { title: "Dense, low-cover wards", desc: "Urban heat island intensity & poor air flow." },
];

const WHERE = [
  { title: "Ward-level resolution", desc: "Heat risk localised to administrative response units." },
  { title: "Risk hotspots", desc: "High temperature × low green cover × low cooling capacity." },
  { title: "Geographic pattern", desc: "Western & central demo wards concentrate extreme risk." },
];

const WHY = [
  { title: "Air temperature", desc: "Primary driver of thermal load on the body." },
  { title: "Humidity", desc: "Limits sweat evaporation → WBGT & Heat Index rise." },
  { title: "Vulnerability", desc: "Elderly & worker density amplify exposure consequences." },
];

function Block({ icon, tag, title, items }: { icon: React.ReactNode; tag: string; title: string; items: { title: string; desc: string }[] }) {
  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">{icon}</span>
        <div>
          <p className="label text-blue-700">{tag}</p>
          <p className="text-sm font-bold text-slate-900">{title}</p>
        </div>
      </div>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.title}>
            <p className="text-sm font-semibold text-slate-800">{it.title}</p>
            <p className="text-xs leading-relaxed text-slate-500">{it.desc}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The core HEATSHIELD narrative: WHO is vulnerable, WHERE risk sits, WHY it exists. */
export default function WhoWhereWhy() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Block icon={<Users className="h-5 w-5" />} tag="WHO" title="Vulnerable groups" items={WHO} />
      <Block icon={<MapIcon className="h-5 w-5" />} tag="WHERE" title="Ward-level risk" items={WHERE} />
      <Block icon={<AlertTriangle className="h-5 w-5" />} tag="WHY" title="Risk drivers" items={WHY} />
    </div>
  );
}