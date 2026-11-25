import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected rendering error' };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AEGIS UI ErrorBoundary:', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e] p-6 text-[#f8fafc]">
          <div className="max-w-md rounded-xl border border-[#ef4444]/40 bg-[#111827] p-6">
            <div className="flex items-center gap-2 text-[#ef4444]">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                SOC Interface Recovery
              </h2>
            </div>
            <p className="mt-2 text-xs text-[#94a3b8]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-[#151e30] px-3 py-1.5 text-xs font-medium text-[#f8fafc] hover:border-slate-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
