import React from "react";
import { CheckCircle2 } from "lucide-react";
import { copy } from "../../copy";

export type StepState = "current" | "done" | "upcoming";

export interface StepItem {
  number: 1 | 2 | 3;
  title: string;
}

export interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onSelectStep?: (step: 1 | 2 | 3) => void;
  className?: string;
}

/**
 * StepIndicator: 3 steps (Choose a clip, Two checks run, Decision; current, done and upcoming states).
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  onSelectStep,
  className = "",
}) => {
  const steps: StepItem[] = [
    { number: 1, title: copy.steps.chooseClip },
    { number: 2, title: copy.steps.twoChecksRun },
    { number: 3, title: copy.steps.decision },
  ];

  return (
    <nav
      aria-label="Analysis process progress"
      className={`w-full py-3 px-4 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-xs flex items-center justify-between ${className}`}
    >
      <ol className="flex items-center w-full gap-2 sm:gap-4 list-none m-0 p-0">
        {steps.map((step, idx) => {
          const stepState: StepState =
            step.number < currentStep
              ? "done"
              : step.number === currentStep
              ? "current"
              : "upcoming";

          return (
            <React.Fragment key={step.number}>
              <li className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!onSelectStep}
                  onClick={() => onSelectStep?.(step.number)}
                  className={`flex items-center gap-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)] rounded-md px-1.5 py-1 ${
                    onSelectStep ? "cursor-pointer" : "cursor-default"
                  } ${
                    stepState === "current"
                      ? "text-[var(--brand-navy)] font-semibold"
                      : stepState === "done"
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0 transition-colors ${
                      stepState === "current"
                        ? "bg-[var(--brand-navy)] text-white"
                        : stepState === "done"
                        ? "bg-[var(--decision-continue-tint)] text-[var(--decision-continue-solid)] border border-[var(--decision-continue-border)]"
                        : "bg-[var(--fill-subtle)] text-[var(--text-muted)] border border-[var(--border)]"
                    }`}
                  >
                    {stepState === "done" ? <CheckCircle2 className="w-4 h-4" /> : step.number}
                  </span>
                  <span className="text-[14px] hidden sm:inline">{step.title}</span>
                </button>
              </li>

              {idx < steps.length - 1 && (
                <li
                  className={`flex-1 h-0.5 transition-colors ${
                    step.number < currentStep
                      ? "bg-[var(--decision-continue-border)]"
                      : "bg-[var(--border)]"
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
