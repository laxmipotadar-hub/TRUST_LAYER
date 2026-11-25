import React from "react";
import { ArrowRight } from "lucide-react";
import { StatusChip, type StatusChipType } from "../../components/ui/StatusChip";
import type { AnalyzeResponse } from "../../types";

export interface PipelineStripProps {
  analysis: AnalyzeResponse | null;
  isLoading: boolean;
}

export const PipelineStrip: React.FC<PipelineStripProps> = ({ analysis, isLoading }) => {
  const getAletheiaStatus = (): StatusChipType => {
    if (isLoading) return "running";
    if (!analysis) return "pending";
    return analysis.aletheia.status === "error" ? "error" : "done";
  };

  const getEidosStatus = (): StatusChipType => {
    if (isLoading) return "pending";
    if (!analysis) return "pending";
    return analysis.eidos.status;
  };

  const getDecisionStatus = (): StatusChipType => {
    if (isLoading) return "pending";
    if (!analysis) return "pending";
    return "done";
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-xs">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">Aletheia</span>
          <StatusChip status={getAletheiaStatus()} />
        </div>

        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">Eidos</span>
          <StatusChip status={getEidosStatus()} />
        </div>

        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">Decision</span>
          <StatusChip status={getDecisionStatus()} />
        </div>
      </div>
    </div>
  );
};
