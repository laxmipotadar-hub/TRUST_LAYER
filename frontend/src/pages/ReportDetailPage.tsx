import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useAnalysis } from "../context/AnalysisContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ModeBadge } from "../components/ui/ModeBadge";
import { Banner } from "../components/ui/Banner";
import { EmptyState } from "../components/ui/EmptyState";
import { copy } from "../copy";
import { aegisApi } from "../lib/api";
import { formatDate, formatSimilarity, formatSyntheticLikelihood } from "../lib/format";
import type { ReportRecord } from "../types";

export const ReportDetailPage: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { reports } = useAnalysis();

  const localRecord = reports.find((r) => r.call_id === callId) || null;
  const [mergedRecord, setMergedRecord] = useState<ReportRecord | null>(localRecord);
  const [backendNotice, setBackendNotice] = useState<string | null>(null);

  useEffect(() => {
    setMergedRecord(localRecord);
    if (!callId || aegisApi.getMode() !== "live") return;

    aegisApi
      .getCallReport(callId)
      .then((backendReport) => {
        if (!localRecord) return;
        setMergedRecord({
          ...localRecord,
          analysis: {
            ...localRecord.analysis,
            aletheia: {
              ...localRecord.analysis.aletheia,
              operation_id:
                backendReport.analysis.aletheia.operation_id ||
                localRecord.analysis.aletheia.operation_id,
            },
            eidos: {
              ...localRecord.analysis.eidos,
              operation_id:
                backendReport.analysis.eidos.operation_id ||
                localRecord.analysis.eidos.operation_id,
            },
          },
        });
      })
      .catch(() => {
        setBackendNotice(copy.reports.backendUnavailableNotice);
      });
  }, [callId, localRecord]);

  if (!mergedRecord) {
    return (
      <EmptyState
        title={copy.reports.emptyTitle}
        description={copy.reports.emptyDesc}
        actionLabel={copy.reports.backToList}
        onAction={() => navigate("/reports")}
      />
    );
  }

  const { analysis, events, caller_label, saved_at, challenge } = mergedRecord;
  const effectiveDecision =
    analysis.liveness.status === "failed" ? "END_CALL" : analysis.decision;

  const nextStepText =
    effectiveDecision === "CONTINUE"
      ? copy.reports.nextStepContinue
      : effectiveDecision === "STEP_UP"
      ? copy.reports.nextStepStepUp
      : copy.reports.nextStepEndCall;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(mergedRecord, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mergedRecord.call_id}_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const breakdownLayers = [
    { label: copy.heuristics.voiceAuthenticity, val: analysis.trust_score.breakdown.voice, src: copy.heuristics.sourceAletheia },
    { label: copy.heuristics.speakerIdentity, val: analysis.trust_score.breakdown.speaker, src: copy.heuristics.sourceEidos },
    { label: copy.heuristics.scamIndicators, val: analysis.trust_score.breakdown.scam, src: copy.heuristics.sourceHeuristic },
    { label: copy.heuristics.behavioralPressure, val: analysis.trust_score.breakdown.behavioural, src: copy.heuristics.sourceHeuristic },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/reports")}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {copy.reports.backToList}
        </Button>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            icon={<Download className="w-4 h-4" />}
          >
            {copy.reports.exportJson}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.print()}
            icon={<Printer className="w-4 h-4" />}
          >
            {copy.reports.printPdf}
          </Button>
        </div>
      </div>

      {backendNotice && <Banner variant="warn">{backendNotice}</Banner>}

      {/* Header */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="page-title font-mono">{mergedRecord.call_id}</h2>
            <p className="caption-text">
              {caller_label} • {formatDate(saved_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModeBadge mode={analysis.mode} />
            <Badge
              variant={
                effectiveDecision === "CONTINUE"
                  ? "success"
                  : effectiveDecision === "STEP_UP"
                  ? "warning"
                  : "danger"
              }
            >
              {effectiveDecision}
            </Badge>
          </div>
        </div>
        <p className="caption-text">{copy.app.footerPower}</p>
      </Card>

      {/* Aletheia & Eidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="space-y-2">
          <h3 className="card-title">{copy.checks.aletheiaTitle}</h3>
          <p className="font-semibold">{formatSyntheticLikelihood(analysis.aletheia.score)}</p>
          <p className="caption-text font-mono">
            {copy.technicalDetails.operationId}: {analysis.aletheia.operation_id || copy.states.unavailable}
          </p>
          <p className="caption-text">
            {copy.technicalDetails.costCredits}: {analysis.aletheia.cost_credits}
          </p>
        </Card>

        <Card className="space-y-2">
          <h3 className="card-title">{copy.checks.eidosTitle}</h3>
          <p className="font-semibold">
            {analysis.eidos.status === "skipped"
              ? copy.checks.eidosSkippedAletheia
              : formatSimilarity(analysis.eidos.similarity)}
          </p>
          <p className="caption-text font-mono">
            {copy.technicalDetails.operationId}: {analysis.eidos.operation_id || copy.states.unavailable}
          </p>
          <p className="caption-text">
            {copy.technicalDetails.costCredits}: {analysis.eidos.cost_credits ?? 0}
          </p>
        </Card>
      </div>

      {/* Four-layer risk index */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="card-title">
            {copy.heuristics.title}: {analysis.trust_score.value} ({analysis.trust_score.band})
          </h3>
          {challenge && (
            <span className="caption-text font-semibold">Challenge: {challenge.status}</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {breakdownLayers.map((layer) => (
            <div key={layer.label} className="p-3 bg-[var(--fill-subtle)] rounded-lg border border-[var(--border)]">
              <div className="flex justify-between text-[14px] font-semibold">
                <span>{layer.label}</span>
                <span>{layer.val}</span>
              </div>
              <p className="caption-text mt-1">{layer.src}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Next Steps & Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="space-y-2">
          <h3 className="card-title">{copy.reports.nextStepsTitle}</h3>
          <p className="body-text">{nextStepText}</p>
        </Card>

        <Card className="space-y-2">
          <h3 className="card-title">{copy.alertsTimeline.title}</h3>
          <ul className="space-y-2 list-none m-0 p-0 text-[14px]">
            {events.map((evt) => (
              <li key={evt.id} className="border-b border-[var(--border)] pb-1.5 last:border-b-0">
                <span className="font-mono caption-text mr-2">{formatDate(evt.ts)}</span>
                <span>{evt.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};
