import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ModeBadge } from "../../components/ui/ModeBadge";
import { copy } from "../../copy";
import type { DecisionType, LivenessStatus, ModeType } from "../../types";

export interface DecisionCardProps {
  decision: DecisionType;
  mode: ModeType;
  livenessStatus: LivenessStatus;
  actionLabel?: string;
  onPrimaryAction: () => void;
  className?: string;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  mode,
  livenessStatus,
  actionLabel,
  onPrimaryAction,
  className = "",
}) => {
  const effectiveDecision: DecisionType = livenessStatus === "failed" ? "END_CALL" : decision;

  const config = {
    CONTINUE: {
      variant: "decision-continue" as const,
      icon: <CheckCircle2 className="w-10 h-10 text-[var(--decision-continue-solid)] shrink-0" />,
      headline: copy.decisions.continue.headline,
      headlineColor: "text-[var(--decision-continue-text)]",
      summary: copy.decisions.continue.summary,
      notice: copy.decisions.continue.mandatoryNotice,
      buttonVariant: "primary" as const,
      defaultAction: copy.decisions.continue.actionLabel,
    },
    STEP_UP: {
      variant: "decision-stepup" as const,
      icon: <AlertTriangle className="w-10 h-10 text-[var(--decision-stepup-solid)] shrink-0" />,
      headline: copy.decisions.stepUp.headline,
      headlineColor: "text-[var(--decision-stepup-text)]",
      summary: copy.decisions.stepUp.summary,
      notice: copy.decisions.stepUp.actionOnHold,
      buttonVariant: "secondary" as const,
      defaultAction: copy.decisions.stepUp.actionLabel,
    },
    END_CALL: {
      variant: "decision-endcall" as const,
      icon: <XCircle className="w-10 h-10 text-[var(--decision-endcall-solid)] shrink-0" />,
      headline: copy.decisions.endCall.headline,
      headlineColor: "text-[var(--decision-endcall-text)]",
      summary:
        livenessStatus === "failed"
          ? copy.liveness.overrideLine
          : copy.decisions.endCall.summary,
      notice: copy.decisions.endCall.actionOnHold,
      buttonVariant: "danger" as const,
      defaultAction: copy.decisions.endCall.actionLabel,
    },
  }[effectiveDecision];

  return (
    <Card variant={config.variant} className={`!p-5 space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-black/10 pb-2">
        <span className="caption-text font-medium text-[var(--text-secondary)]">
          {copy.app.footerPower}
        </span>
        <ModeBadge mode={mode} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          {config.icon}
          <div>
            <h1 className={`text-[32px] sm:text-[36px] font-extrabold tracking-tight leading-none ${config.headlineColor}`}>
              {config.headline}
            </h1>
            <p className="text-[16px] font-medium text-[var(--text-primary)] mt-1">
              {config.summary}
            </p>
          </div>
        </div>

        <Button
          variant={config.buttonVariant}
          size="md"
          onClick={onPrimaryAction}
          icon={<ArrowRight className="w-4 h-4" />}
          className="shrink-0"
        >
          {actionLabel || config.defaultAction}
        </Button>
      </div>

      <div className="px-3 py-2 rounded-lg bg-white/80 border border-black/5 text-[14px] font-medium text-[var(--text-secondary)] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
        <span>{config.notice}</span>
      </div>
    </Card>
  );
};
