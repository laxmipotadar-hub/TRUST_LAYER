import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ModeBadge } from "../../components/ui/ModeBadge";
import { copy } from "../../copy";
import type { CallDecision, ExecutionMode, FusionBand } from "../../types";

export interface DecisionCardProps {
  decision: CallDecision;
  band: FusionBand;
  mode: ExecutionMode;
  recommendedAction: string;
  livenessOverrideApplied: boolean;
  voiceCloneOverrideApplied?: boolean;
  onPrimaryAction: () => void;
  className?: string;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  band,
  mode,
  recommendedAction,
  livenessOverrideApplied,
  voiceCloneOverrideApplied,
  onPrimaryAction,
  className = "",
}) => {
  const effective = decision === "INCOMPLETE ANALYSIS" ? "STEP_UP" : decision;

  const config = {
    ALLOW: {
      variant: "decision-continue" as const,
      icon: <CheckCircle2 className="w-10 h-10 text-[var(--decision-continue-solid)] shrink-0" />,
      headline: "ALLOW",
      headlineColor: "text-[var(--decision-continue-text)]",
      buttonVariant: "primary" as const,
      ctaLabel: copy.decisions.continue.actionLabel,
      notice: copy.decisions.continue.mandatoryNotice,
    },
    STEP_UP: {
      variant: "decision-stepup" as const,
      icon: <AlertTriangle className="w-10 h-10 text-[var(--decision-stepup-solid)] shrink-0" />,
      headline: decision === "INCOMPLETE ANALYSIS" ? "INCOMPLETE ANALYSIS" : "STEP_UP",
      headlineColor: "text-[var(--decision-stepup-text)]",
      buttonVariant: "secondary" as const,
      ctaLabel: copy.decisions.stepUp.actionLabel,
      notice: copy.decisions.stepUp.actionOnHold,
    },
    BLOCK: {
      variant: "decision-endcall" as const,
      icon: <XCircle className="w-10 h-10 text-[var(--decision-endcall-solid)] shrink-0" />,
      headline: "BLOCK",
      headlineColor: "text-[var(--decision-endcall-text)]",
      buttonVariant: "danger" as const,
      ctaLabel: copy.decisions.endCall.actionLabel,
      notice: livenessOverrideApplied
        ? copy.liveness.overrideLine
        : voiceCloneOverrideApplied
        ? "Aletheia synthetic + Eidos match -> voice-clone override forced BLOCK."
        : copy.decisions.endCall.actionOnHold,
    },
    END_CALL: {
      variant: "decision-endcall" as const,
      icon: <XCircle className="w-10 h-10 text-[var(--decision-endcall-solid)] shrink-0" />,
      headline: "END_CALL",
      headlineColor: "text-[var(--decision-endcall-text)]",
      buttonVariant: "danger" as const,
      ctaLabel: copy.decisions.endCall.actionLabel,
      notice: livenessOverrideApplied
        ? copy.liveness.overrideLine
        : copy.decisions.endCall.actionOnHold,
    },
  }[effective];

  return (
    <Card variant={config.variant} className={`!p-5 space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
        <span className="caption-text font-medium text-[var(--text-secondary)]">
          {copy.app.footerPower} · DetectifAI and Groq · Fusion Band: <strong>{band}</strong>
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
              {recommendedAction}
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
          {config.ctaLabel}
        </Button>
      </div>

      <div className="px-3 py-2 rounded-lg bg-white/80 border border-black/5 text-[14px] font-medium text-[var(--text-secondary)] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
        <span>{config.notice}</span>
      </div>
    </Card>
  );
};
