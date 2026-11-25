import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { copy } from "../../copy";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = copy.states.errorTitle,
  message,
  onRetry,
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`p-6 bg-[var(--decision-endcall-tint)] border border-[var(--decision-endcall-border)] rounded-[12px] text-center flex flex-col items-center justify-center shadow-xs ${className}`}
    >
      <div className="p-3 bg-white text-[var(--decision-endcall-solid)] rounded-full mb-3 shadow-xs">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h3 className="text-[18px] font-semibold text-[var(--decision-endcall-text)] mb-1">
        {title}
      </h3>
      <p className="text-[14px] text-[var(--decision-endcall-text)] max-w-md mb-4 opacity-90 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="danger"
          size="sm"
          onClick={onRetry}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          {copy.states.retryButton}
        </Button>
      )}
    </div>
  );
};
