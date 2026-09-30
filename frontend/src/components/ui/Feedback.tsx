import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">Could not load data</p>
        <p className="text-xs text-red-600/90">{message}</p>
      </div>
    </div>
  );
}

export function DemoNotice({
  text,
  className = "",
  compact = false,
}: {
  text: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 ${
        compact ? "px-3 py-2 text-[11px]" : "px-4 py-3 text-xs"
      } ${className}`}
    >
      <span className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400" />
      <p>{text}</p>
    </div>
  );
}

export function InlineMetric({
  label,
  value,
  suffix,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 ${className}`}>
      <div className="label">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
        {value}
        {suffix && <span className="ml-0.5 text-sm font-normal text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}