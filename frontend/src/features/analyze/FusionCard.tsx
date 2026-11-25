import React from "react";
import { AlertCircle, Layers } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { CallSession } from "../../types";

export interface FusionCardProps {
  call: CallSession;
  onOpenTechnicalDetails: () => void;
}

export const FusionCard: React.FC<FusionCardProps> = ({
  call,
  onOpenTechnicalDetails,
}) => {
  const tb = call.trust_breakdown;
  const bandVariant =
    tb.band === "SAFE"
      ? "success"
      : tb.band === "REVIEW"
      ? "warning"
      : "danger";
  const decisionVariant =
    tb.decision === "ALLOW"
      ? "success"
      : tb.decision === "STEP_UP"
      ? "warning"
      : "danger";

  return (
    <Card className="!p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Layers className="w-5 h-5 text-[var(--brand-steel)] shrink-0" />
          <h2 className="section-title">Heuristic Risk Index</h2>
          <span className="text-[26px] font-extrabold text-[var(--text-primary)]">
            {tb.composite_score !== null ? tb.composite_score.toFixed(1) : "Unavailable"}
          </span>
          <Badge variant={bandVariant}>Band: {tb.band}</Badge>
          <Badge variant={decisionVariant}>Decision: {tb.decision}</Badge>
          {tb.ema_applied && tb.raw_composite_score !== null && tb.raw_composite_score !== undefined && (
            <span className="text-[14px] text-[var(--text-muted)] font-mono">
              (EMA smoothed from raw {tb.raw_composite_score.toFixed(1)})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenTechnicalDetails}
          className="text-[14px] font-semibold text-[var(--brand-steel)] hover:underline cursor-pointer"
        >
          Inspect full telemetry
        </button>
      </div>

      <p className="text-[14px] font-mono text-[var(--text-secondary)] bg-[var(--fill-subtle)] px-3 py-2 rounded-lg border border-[var(--border)]">
        {tb.formula_summary}
      </p>

      {(tb.conflict_overrides && tb.conflict_overrides.length > 0) || tb.policy_override_applied ? (
        <div className="p-3 rounded-lg bg-[var(--decision-endcall-tint)] border border-[var(--decision-endcall-border)] text-[14px] font-semibold text-[var(--decision-endcall-text)] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="block">Conflict Override Fired:</span>
            {tb.conflict_overrides && tb.conflict_overrides.length > 0 ? (
              tb.conflict_overrides.map((ovr) => (
                <span key={ovr} className="block font-normal">
                  {ovr}
                </span>
              ))
            ) : (
              <span className="block font-normal">{tb.policy_override_applied}</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tb.factor_contributions.map((fc) => {
          const score = fc.raw_score ?? 0;
          return (
            <div
              key={fc.key}
              className="p-3 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[14px]">
                <span className="font-semibold text-[var(--text-primary)] truncate">{fc.label}</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {fc.raw_score !== null ? fc.raw_score.toFixed(1) : "N/A"}
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    fc.raw_score === null
                      ? "bg-[var(--text-muted)]"
                      : score >= 75
                      ? "bg-[var(--decision-continue-solid)]"
                      : score >= 40
                      ? "bg-[var(--decision-stepup-solid)]"
                      : "bg-[var(--decision-endcall-solid)]"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[14px] text-[var(--text-muted)] font-mono">
                <span>w={(fc.weight * 100).toFixed(0)}%</span>
                <span>+{fc.weighted_points.toFixed(1)} pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
