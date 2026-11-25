import React from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Tooltip } from "../../components/ui/Tooltip";
import { copy } from "../../copy";
import type { DecisionType, LivenessStatus, TrustScore } from "../../types";

export interface HeuristicRiskRowProps {
  trustScore: TrustScore;
  decision: DecisionType;
  livenessStatus: LivenessStatus;
  onOpenTechnicalDetails: () => void;
}

const BAND_EXPECTED_DECISION: Record<TrustScore["band"], DecisionType> = {
  SAFE: "CONTINUE",
  CAUTION: "STEP_UP",
  THREAT: "END_CALL",
};

export const HeuristicRiskRow: React.FC<HeuristicRiskRowProps> = ({
  trustScore,
  decision,
  livenessStatus,
  onOpenTechnicalDetails,
}) => {
  const { value, band, breakdown } = trustScore;
  const bandDisagrees = BAND_EXPECTED_DECISION[band] !== decision;

  const badgeVariant =
    band === "SAFE" ? "success" : band === "CAUTION" ? "warning" : "danger";

  const segments = [
    {
      key: "voice",
      label: copy.heuristics.voiceAuthenticity,
      val: breakdown.voice,
      source: copy.heuristics.sourceAletheia,
    },
    {
      key: "speaker",
      label: copy.heuristics.speakerIdentity,
      val: breakdown.speaker,
      source: copy.heuristics.sourceEidos,
    },
    {
      key: "scam",
      label: copy.heuristics.scamIndicators,
      val: breakdown.scam,
      source: copy.heuristics.sourceHeuristic,
    },
    {
      key: "behavioural",
      label: copy.heuristics.behavioralPressure,
      val: breakdown.behavioural,
      source: copy.heuristics.sourceHeuristic,
    },
  ];

  return (
    <Card className="!p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="section-title">{copy.heuristics.title}</h2>
            <Tooltip content={copy.tooltips.heuristicRisk} />
          </div>
          <span className="text-[24px] font-extrabold text-[var(--text-primary)]">
            {value}
          </span>
          <Badge variant={badgeVariant}>{band}</Badge>
          <span className="caption-text font-medium">{copy.heuristics.separateFromDecision}</span>
        </div>

        <button
          type="button"
          onClick={onOpenTechnicalDetails}
          className="text-[14px] font-semibold text-[var(--brand-steel)] hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)] rounded px-1"
        >
          {copy.technicalDetails.buttonOpen}
        </button>
      </div>

      {/* Liveness Override or Band/Decision Disagreement Notice */}
      {livenessStatus === "failed" && (
        <div className="p-2.5 rounded-lg bg-[var(--decision-endcall-tint)] border border-[var(--decision-endcall-border)] text-[14px] font-semibold text-[var(--decision-endcall-text)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{copy.liveness.overrideLine}</span>
        </div>
      )}

      {bandDisagrees && (
        <div className="p-2.5 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] text-[14px] text-[var(--text-secondary)] flex items-center justify-between gap-2">
          <span>
            Index band: <strong>{band}</strong> | Final decision: <strong>{decision}</strong>
          </span>
          <span className="caption-text">{copy.heuristics.disagreementNote}</span>
        </div>
      )}

      {/* SegmentedBar for 4 breakdown layers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="p-3 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] space-y-1.5"
          >
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-semibold text-[var(--text-primary)]">{seg.label}</span>
              <span className="font-bold text-[var(--text-primary)]">{seg.val}</span>
            </div>
            <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  seg.val >= 75
                    ? "bg-[var(--decision-continue-solid)]"
                    : seg.val >= 40
                    ? "bg-[var(--decision-stepup-solid)]"
                    : "bg-[var(--decision-endcall-solid)]"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, seg.val))}%` }}
              />
            </div>
            <p className="caption-text text-[14px]">{seg.source}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
