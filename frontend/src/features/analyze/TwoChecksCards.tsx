import React from "react";
import { Shield, UserCheck, UserX } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Tooltip } from "../../components/ui/Tooltip";
import { Skeleton } from "../../components/ui/Skeleton";
import { copy } from "../../copy";
import type { AletheiaResult, EidosResult } from "../../types";
import { formatSimilarity, formatSyntheticLikelihood } from "../../lib/format";

export interface TwoChecksCardsProps {
  aletheia?: AletheiaResult;
  eidos?: EidosResult;
  isLoading: boolean;
}

export const TwoChecksCards: React.FC<TwoChecksCardsProps> = ({
  aletheia,
  eidos,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="!p-4 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-36" />
        </Card>
        <Card className="!p-4 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-36" />
        </Card>
      </div>
    );
  }

  if (!aletheia || !eidos) return null;

  const isAletheiaFake = aletheia.verdict === "fake";
  const isEidosMatch = eidos.decision === "match";
  const isEidosSkipped = eidos.status === "skipped";
  const isAletheiaSkip = eidos.skip_reason === "aletheia_fake";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Check 1: Aletheia */}
      <Card
        className={`!p-4 ${
          isAletheiaFake
            ? "!bg-[var(--decision-endcall-tint)] !border-[var(--decision-endcall-border)]"
            : "!bg-[var(--decision-continue-tint)] !border-[var(--decision-continue-border)]"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Shield
              className={`w-4 h-4 shrink-0 ${
                isAletheiaFake
                  ? "text-[var(--decision-endcall-solid)]"
                  : "text-[var(--decision-continue-solid)]"
              }`}
            />
            <h3 className="card-title">{copy.checks.aletheiaTitle}</h3>
          </div>
          <Tooltip content={copy.tooltips.syntheticLikelihood} />
        </div>

        <p
          className={`text-[14px] font-semibold mt-1.5 ${
            isAletheiaFake
              ? "text-[var(--decision-endcall-text)]"
              : "text-[var(--decision-continue-text)]"
          }`}
        >
          {isAletheiaFake ? copy.checks.aletheiaFake : copy.checks.aletheiaReal}
        </p>

        <p className="text-[14px] font-medium text-[var(--text-primary)] mt-1">
          {formatSyntheticLikelihood(aletheia.score)}
        </p>
      </Card>

      {/* Check 2: Eidos */}
      <Card
        className={`!p-4 ${
          isEidosSkipped
            ? "!bg-[var(--fill-subtle)] !border-[var(--border)]"
            : isEidosMatch
            ? "!bg-[var(--decision-continue-tint)] !border-[var(--decision-continue-border)]"
            : "!bg-[var(--decision-stepup-tint)] !border-[var(--decision-stepup-border)]"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isEidosSkipped ? (
              <Shield className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            ) : isEidosMatch ? (
              <UserCheck className="w-4 h-4 text-[var(--decision-continue-solid)] shrink-0" />
            ) : (
              <UserX className="w-4 h-4 text-[var(--decision-stepup-solid)] shrink-0" />
            )}
            <h3 className="card-title">{copy.checks.eidosTitle}</h3>
          </div>
          <Tooltip content={copy.tooltips.similarity} />
        </div>

        <p
          className={`text-[14px] font-semibold mt-1.5 ${
            isEidosSkipped
              ? "text-[var(--text-secondary)]"
              : isEidosMatch
              ? "text-[var(--decision-continue-text)]"
              : "text-[var(--decision-stepup-text)]"
          }`}
        >
          {isEidosSkipped
            ? isAletheiaSkip
              ? copy.checks.eidosSkippedAletheia
              : copy.checks.eidosSkippedUnenrolled
            : isEidosMatch
            ? copy.checks.eidosMatch
            : copy.checks.eidosNoMatch}
        </p>

        <p className="text-[14px] font-medium text-[var(--text-primary)] mt-1">
          {isEidosSkipped ? copy.states.unavailable : formatSimilarity(eidos.similarity)}
        </p>
      </Card>
    </div>
  );
};
