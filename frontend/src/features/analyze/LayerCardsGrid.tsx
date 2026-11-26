import React, { useState } from "react";
import {
  Shield,
  UserCheck,
  FileWarning,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Code2,
  RotateCcw,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { StatusChip } from "../../components/ui/StatusChip";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import type { CallSession, LayerRunStatus } from "../../types";
import type { LayerStatuses } from "../../context/AnalysisContext";
import { formatSimilarity, formatSyntheticLikelihood } from "../../lib/format";

export interface LayerCardsGridProps {
  call: CallSession | null;
  statuses: LayerStatuses;
  isLoading: boolean;
  onRetryEidos?: () => void;
}

interface ExpandableLayerProps {
  title: string;
  icon: React.ReactNode;
  status: LayerRunStatus;
  statusLabel?: string;
  scoreLabel: string;
  latencyMs?: number | null;
  modelVersion?: string;
  operationId?: string | null;
  summary: string;
  rawPayload: unknown;
  children?: React.ReactNode;
}

const ExpandableLayerCard: React.FC<ExpandableLayerProps> = ({
  title,
  icon,
  status,
  statusLabel,
  scoreLabel,
  latencyMs,
  modelVersion,
  operationId,
  summary,
  rawPayload,
  children,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showJson, setShowJson] = useState(false);

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="card-title truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusChip status={status} label={statusLabel} />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-[var(--fill-subtle)] text-[var(--text-secondary)] cursor-pointer"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
        <span className="font-bold text-[var(--text-primary)]">{scoreLabel}</span>
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--text-muted)] font-mono">
          <span>
            {latencyMs !== null && latencyMs !== undefined ? `${latencyMs.toFixed(0)} ms` : "— ms"}
          </span>
          <span>•</span>
          <span>{modelVersion || "v1"}</span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2.5 pt-2 border-t border-[var(--border)] text-[14px]">
          <p className="text-[var(--text-secondary)]">{summary}</p>
          {operationId && (
            <p className="font-mono text-[14px] text-[var(--text-muted)] truncate">
              op_id: {operationId}
            </p>
          )}
          {children}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowJson((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--brand-steel)] hover:underline cursor-pointer"
            >
              <Code2 className="w-4 h-4" />
              <span>{showJson ? "Hide raw API JSON" : "Show raw API JSON"}</span>
            </button>
            {showJson && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] p-2.5 font-mono text-[14px] text-[var(--text-primary)]">
                {JSON.stringify(rawPayload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export const LayerCardsGrid: React.FC<LayerCardsGridProps> = ({
  call,
  statuses,
  isLoading,
  onRetryEidos,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="!p-4 space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
        ))}
      </div>
    );
  }

  if (!call) return null;

  const v = call.voice_authenticity;
  const e = call.speaker_identity;
  const s = call.scam_analysis;
  const m = call.manipulation_analysis;

  const rawDecision =
    e.decision ||
    (e.raw_payload as { result?: { decision?: string } } | null)?.result?.decision;
  const normalizedDecision = rawDecision ? String(rawDecision).toUpperCase() : null;
  const eidosMatched =
    statuses.eidos === "done" &&
    (e.status === "PASS" || normalizedDecision === "MATCH");

  const eidosSkippedLabel =
    e.skip_reason === "aletheia_fake"
      ? "Skipped — Eidos not needed, 1 call saved"
      : e.skip_reason === "no_voice_id"
      ? "Skipped — No live Voice ID enrolled"
      : "Skipped";

  const scriptUnavailable =
    s.status === "UNAVAILABLE" || s.risk_score === null || s.safety_score === null;
  const manipUnavailable =
    m.status === "UNAVAILABLE" || m.score === null || m.safety_score === null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Layer 1: Aletheia */}
      <ExpandableLayerCard
        title="Layer 1 · Aletheia Voice Authenticity"
        icon={<Shield className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />}
        status={statuses.aletheia}
        scoreLabel={
          v.score !== null && v.score !== undefined
            ? `Authenticity ${v.score.toFixed(1)}/100 · ${formatSyntheticLikelihood(v.deepfake_probability)}`
            : "Score Unavailable"
        }
        latencyMs={v.latency_ms}
        modelVersion={v.model_version || v.model_name}
        operationId={v.operation_id || v.request_id}
        summary={v.detail}
        rawPayload={v.raw_payload || v}
      >
        {v.artifacts_detected.length > 0 && (
          <ul className="list-disc pl-5 space-y-1 text-[var(--decision-endcall-text)]">
            {v.artifacts_detected.map((art, i) => (
              <li key={i}>{art}</li>
            ))}
          </ul>
        )}
      </ExpandableLayerCard>

      {/* Layer 2: Eidos */}
      <ExpandableLayerCard
        title="Layer 2 · Eidos Speaker Identity"
        icon={<UserCheck className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />}
        status={statuses.eidos}
        scoreLabel={
          statuses.eidos === "skipped"
            ? eidosSkippedLabel
            : e.score !== null && e.score !== undefined
            ? `Speaker Score ${e.score.toFixed(1)}/100 · ${formatSimilarity(e.match_confidence)}`
            : "Speaker Score Unavailable"
        }
        latencyMs={e.latency_ms}
        modelVersion={e.model_version || e.model_name}
        operationId={e.operation_id || e.request_id}
        summary={e.detail}
        rawPayload={e.raw_payload || e}
      >
        <div className="flex flex-wrap items-center gap-2">
          {statuses.eidos === "skipped" ? (
            <Badge variant="neutral" size="sm">
              {eidosSkippedLabel}
            </Badge>
          ) : statuses.eidos === "error" ? (
            <>
              <Badge variant="danger" size="sm">
                {e.http_status ? `HTTP ${e.http_status} Error` : "Eidos Error"}
              </Badge>
              {onRetryEidos && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onRetryEidos}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Retry
                </Button>
              )}
            </>
          ) : (
            <>
              <Badge variant={e.enrolled ? "success" : "warning"} size="sm">
                {e.enrolled ? "Enrolled voiceprint" : "Unenrolled (50.0 neutral)"}
              </Badge>
              {normalizedDecision && normalizedDecision !== "SKIPPED" && (
                <Badge variant={eidosMatched ? "success" : "danger"} size="sm">
                  {normalizedDecision}
                </Badge>
              )}
              {e.provider_speaker_id && (
                <Badge variant="neutral" size="sm">
                  speaker_id: {e.provider_speaker_id}
                </Badge>
              )}
              {eidosMatched && e.matched_customer_name && (
                <Badge variant="info" size="sm">
                  Matched: {e.matched_customer_name}
                </Badge>
              )}
            </>
          )}
        </div>
      </ExpandableLayerCard>

      {/* Layer 3: Script Analysis */}
      <ExpandableLayerCard
        title="Layer 3 · Script Analysis (LLM / Rules)"
        icon={<FileWarning className="w-4 h-4 text-[var(--decision-stepup-solid)] shrink-0" />}
        status={statuses.script}
        statusLabel={scriptUnavailable ? "Unavailable" : undefined}
        scoreLabel={
          scriptUnavailable
            ? "Unavailable (no transcript)"
            : `Safety ${s.safety_score!.toFixed(1)}/100 (Risk ${s.risk_score!.toFixed(1)})`
        }
        latencyMs={s.latency_ms}
        modelVersion={
          s.engine_used.includes("Groq") && s.latency_ms !== null && s.latency_ms !== undefined
            ? `Groq · ${s.latency_ms.toFixed(0)} ms`
            : s.model_version || s.engine_used
        }
        operationId={s.operation_id}
        summary={s.summary}
        rawPayload={s.raw_payload || s}
      >
        {!scriptUnavailable && s.detected_patterns.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {s.detected_patterns.map((pat) => (
              <Badge key={pat} variant="warning" size="sm">
                {pat}
              </Badge>
            ))}
          </div>
        )}
        {!scriptUnavailable && s.flagged_phrases.length > 0 && (
          <ul className="space-y-1.5">
            {s.flagged_phrases.map((fp, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-[var(--fill-subtle)] border border-[var(--border)]"
              >
                <span className="font-semibold text-[var(--decision-endcall-text)]">
                  "{fp.phrase}"
                </span>{" "}
                <span className="text-[var(--text-secondary)]">
                  — {fp.category} (+{fp.weight})
                </span>
              </li>
            ))}
          </ul>
        )}
      </ExpandableLayerCard>

      {/* Layer 4: Manipulation Analysis */}
      <ExpandableLayerCard
        title="Layer 4 · Manipulation Analysis"
        icon={<AlertTriangle className="w-4 h-4 text-[var(--decision-endcall-solid)] shrink-0" />}
        status={statuses.manipulation}
        statusLabel={manipUnavailable ? "Unavailable" : undefined}
        scoreLabel={
          manipUnavailable
            ? "Unavailable (no transcript)"
            : `Safety ${m.safety_score!.toFixed(1)}/100 (Pressure ${m.score!.toFixed(1)})`
        }
        latencyMs={m.latency_ms}
        modelVersion={
          m.latency_ms !== null && m.latency_ms !== undefined && !manipUnavailable
            ? `Groq · ${m.latency_ms.toFixed(0)} ms`
            : m.model_version
        }
        summary={
          manipUnavailable
            ? "Manipulation analysis unavailable (no caller transcript supplied)."
            : `Detected ${m.markers.length} manipulation marker(s) across urgency, secrecy, authority, and threat categories.`
        }
        rawPayload={m.raw_payload || m}
      >
        {!manipUnavailable && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(["urgency", "secrecy", "authority", "threat"] as const).map((cat) => (
              <div
                key={cat}
                className="px-2.5 py-1.5 rounded bg-[var(--fill-subtle)] border border-[var(--border)] flex items-center justify-between"
              >
                <span className="capitalize text-[var(--text-secondary)]">{cat}</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {m.category_counts[cat] || 0}
                </span>
              </div>
            ))}
          </div>
        )}
        {!manipUnavailable && m.markers.length > 0 && (
          <ul className="space-y-1.5">
            {m.markers.slice(0, 4).map((mk, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-[var(--fill-subtle)] border border-[var(--border)]"
              >
                <span className="font-semibold uppercase text-[14px] text-[var(--decision-endcall-text)]">
                  [{mk.category}]
                </span>{" "}
                <span className="text-[var(--text-primary)]">{mk.excerpt}</span>
              </li>
            ))}
          </ul>
        )}
      </ExpandableLayerCard>
    </div>
  );
};
