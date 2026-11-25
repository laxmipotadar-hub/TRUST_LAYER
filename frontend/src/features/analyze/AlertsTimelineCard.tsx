import React from "react";
import { Clock, AlertTriangle, CheckCircle2, Shield, Activity } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { copy } from "../../copy";
import type { EvidenceEvent, ExecutionMode } from "../../types";

export interface AlertsTimelineCardProps {
  events: EvidenceEvent[];
  executionMode?: ExecutionMode;
}

function formatEventModeTag(
  provenance: EvidenceEvent["provenance"],
  executionMode?: ExecutionMode
): "REAL" | "CACHED" | "DEMO" {
  if (executionMode === "LIVE") {
    return provenance === "CACHED ANALYSIS" ? "CACHED" : "REAL";
  }
  if (provenance === "CACHED ANALYSIS") return "CACHED";
  if (provenance === "REAL ANALYSIS") return "REAL";
  return "DEMO";
}

export const AlertsTimelineCard: React.FC<AlertsTimelineCardProps> = ({
  events,
  executionMode,
}) => {
  const ordered = [...events].reverse();

  const iconForEvent = (evt: EvidenceEvent) => {
    if (evt.severity === "CRITICAL") {
      return <AlertTriangle className="w-4 h-4 text-[var(--decision-endcall-solid)] shrink-0 mt-0.5" />;
    }
    if (evt.severity === "WARNING") {
      return <Shield className="w-4 h-4 text-[var(--decision-stepup-solid)] shrink-0 mt-0.5" />;
    }
    if (evt.category === "POLICY") {
      return <CheckCircle2 className="w-4 h-4 text-[var(--decision-continue-solid)] shrink-0 mt-0.5" />;
    }
    return <Activity className="w-4 h-4 text-[var(--brand-steel)] shrink-0 mt-0.5" />;
  };

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
        <h3 className="card-title">{copy.alertsTimeline.title}</h3>
      </div>

      {ordered.length === 0 ? (
        <p className="caption-text">{copy.alertsTimeline.empty}</p>
      ) : (
        <ul className="space-y-2.5 list-none m-0 p-0">
          {ordered.map((evt) => (
            <li
              key={evt.id}
              className="flex items-start gap-2.5 text-[14px] border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0"
            >
              {iconForEvent(evt)}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--text-primary)] leading-snug">{evt.title}</p>
                <p className="text-[var(--text-secondary)] leading-snug">{evt.description}</p>
                <span className="caption-text font-mono block mt-0.5">
                  t={evt.timestamp_sec.toFixed(1)}s · {formatEventModeTag(evt.provenance, executionMode)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
