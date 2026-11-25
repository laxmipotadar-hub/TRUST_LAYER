import React from "react";
import { User, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { copy } from "../../copy";
import { formatSimilarity } from "../../lib/format";
import type { CallerMetaState } from "../../context/AnalysisContext";
import type { EidosResult } from "../../types";

export interface CallerCardProps {
  callerMeta: CallerMetaState;
  eidos?: EidosResult;
}

export const CallerCard: React.FC<CallerCardProps> = ({ callerMeta, eidos }) => {
  const similarityDisplay =
    eidos && eidos.status === "done" && eidos.similarity !== undefined
      ? formatSimilarity(eidos.similarity)
      : copy.states.unavailable;

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
        <h3 className="card-title">{copy.callerCard.title}</h3>
      </div>

      <div className="space-y-2 text-[14px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">{copy.callerCard.claimedIdentity}</span>
          <span className="font-semibold text-[var(--text-primary)] text-right truncate">
            {callerMeta.callerLabel || copy.states.unavailable}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">{copy.callerCard.enrollmentStatus}</span>
          <Badge variant={callerMeta.enrolled ? "success" : "warning"} size="sm">
            {callerMeta.enrolled ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {copy.callerCard.enrolled}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                {copy.callerCard.notEnrolled}
              </span>
            )}
          </Badge>
        </div>

        <div className="pt-1 border-t border-[var(--border)]">
          <span className="text-[var(--text-muted)] block">{copy.callerCard.similarity}</span>
          <span className="font-semibold text-[var(--text-primary)]">{similarityDisplay}</span>
        </div>
      </div>
    </Card>
  );
};
