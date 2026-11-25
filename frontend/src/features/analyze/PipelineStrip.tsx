import React from "react";
import { ArrowRight } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import type { CallSession } from "../../types";
import type { LayerStatuses } from "../../context/AnalysisContext";

export interface PipelineStripProps {
  call: CallSession | null;
  layerStatuses: LayerStatuses;
  isLoading: boolean;
}

export const PipelineStrip: React.FC<PipelineStripProps> = ({
  call,
  layerStatuses,
  isLoading,
}) => {
  const audioSt = isLoading ? "done" : call ? "done" : "queued";
  const transcriptSt = isLoading ? "running" : call ? "done" : "queued";
  const fusionSt = isLoading
    ? "queued"
    : !call
    ? "queued"
    : call.trust_score === null
    ? "error"
    : "done";
  const decisionSt = isLoading ? "queued" : call ? "done" : "queued";
  const actionsSt = call && call.actions_taken.length > 0 ? "done" : call ? "pending" : "queued";

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

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">Operator Actions</span>
          <StatusChip status={actionsSt} />
        </div>
      </div>
    </div>
  );
};
