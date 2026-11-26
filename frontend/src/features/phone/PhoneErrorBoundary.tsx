import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface PhoneErrorBoundaryProps {
  children: React.ReactNode;
}

interface PhoneErrorBoundaryState {
  hasError: boolean;
}

export class PhoneErrorBoundary extends React.Component<
  PhoneErrorBoundaryProps,
  PhoneErrorBoundaryState
> {
  constructor(props: PhoneErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): PhoneErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-[var(--decision-endcall-border)] bg-[var(--decision-endcall-tint)] p-4 text-center space-y-3"
        >
          <div className="flex justify-center">
            <AlertTriangle className="w-6 h-6 text-[var(--decision-endcall-solid)]" />
          </div>
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
            Phone preview unavailable, reload
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand-navy)] text-white text-[14px] font-medium cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Preview
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
