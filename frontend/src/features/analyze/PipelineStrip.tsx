import React from "react";
import { ArrowRight } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import type { CallSession } from "../../types";
import type { LayerStatuses } from "../../context/AnalysisContext";
import type { PipelinePhoneStageStatuses } from "../phone/phoneStateMachine";

export interface PipelineStripProps {
  call: CallSession | null;
  layerStatuses: LayerStatuses;
  isLoading: boolean;
  phoneStages?: PipelinePhoneStageStatuses;
  operatorActionStatus?: "idle" | "running" | "done" | "error" | "timeout";
  operatorActionReason?: string | null;
}

export const PipelineStrip: React.FC<PipelineStripProps> = ({
  call,
  layerStatuses,
  isLoading,
  phoneStages,
  operatorActionStatus = "idle",
  operatorActionReason = null,
}) => {
  const audioSt =
    phoneStages && phoneStages.audioInput !== "queued"
      ? phoneStages.audioInput
      : isLoading
      ? "done"
      : call
      ? "done"
      : "queued";
  const transcriptSt = layerStatuses.asr;
  const fusionSt = isLoading
    ? "queued"
    : !call
    ? "queued"
    : call.trust_score === null
    ? "error"
    : "done";
  const decisionSt = isLoading ? "queued" : call ? "done" : "queued";
  const livenessSt = phoneStages ? phoneStages.liveness : "skipped";
  const actionsSt =
    operatorActionStatus === "running"
      ? "running"
      : operatorActionStatus === "timeout" || operatorActionStatus === "error"
      ? "error"
      : operatorActionStatus === "done" || (call && call.actions_taken.length > 0)
      ? "done"
      : phoneStages && phoneStages.operator !== "queued"
      ? phoneStages.operator
      : call
      ? "pending"
      : "queued";
  const actionsLabel =
    operatorActionStatus === "timeout"
      ? "Timed out (30s)"
      : operatorActionStatus === "error"
      ? "Error"
      : undefined;

  return (
    <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-xs overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">Audio Input</span>
          <StatusChip status={audioSt} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">ASR / Transcript</span>
          <StatusChip status={transcriptSt} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">L1 Aletheia</span>
          <StatusChip status={layerStatuses.aletheia} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">L2 Eidos</span>
          <StatusChip status={layerStatuses.eidos} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">L3 Script</span>
          <StatusChip status={layerStatuses.script} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">L4 Manipulation</span>
          <StatusChip status={layerStatuses.manipulation} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">Trust Fusion</span>
          <StatusChip status={fusionSt} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">Decision</span>
          <StatusChip status={decisionSt} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        {phoneStages && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[var(--text-primary)]">Liveness</span>
              <StatusChip status={livenessSt} />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </>
        )}

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">Operator Actions</span>
          <StatusChip status={actionsSt} label={actionsLabel} />
        </div>
      </div>
      {(operatorActionStatus === "timeout" || operatorActionStatus === "error") && operatorActionReason && (
        <p className="mt-2 text-[13px] font-medium text-[var(--decision-endcall-text)]">
          {operatorActionReason}
        </p>
      )}
    </div>
  );
};
