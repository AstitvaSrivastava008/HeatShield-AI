import { Component } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** App-level error boundary so a runtime error never blanks the whole dashboard. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("HEATSHIELD UI error boundary caught:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
          <div className="card card-pad max-w-md">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-sm font-bold text-slate-900">Something went wrong</h1>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  An unexpected UI error occurred. This is a prototype — refresh the page to recover.
                </p>
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-slate-100 p-2 text-[11px] text-slate-600">
                  {this.state.error.message}
                </pre>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}