import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Banner";
import { ModeBadge } from "../components/ui/ModeBadge";
import { ErrorState } from "../components/ui/ErrorState";
import { Skeleton } from "../components/ui/Skeleton";
import { useAnalysis } from "../context/AnalysisContext";
import { aegisApi } from "../lib/api";
import { copy } from "../copy";
import { formatDate } from "../lib/format";
import type { CallReportResponse } from "../types";

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { submitFeedback, refreshReports } = useAnalysis();

  const [report, setReport] = useState<CallReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fbLabel, setFbLabel] = useState<"SCAM" | "LEGITIMATE" | "UNCERTAIN">("SCAM");
  const [fbNotes, setFbNotes] = useState("");
  const [fbSaving, setFbSaving] = useState(false);
  const [fbMessage, setFbMessage] = useState<string | null>(null);

  const loadReport = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aegisApi.getCallReport(id);
      setReport(data);
      if (data.call_session.feedback) {
        setFbLabel(data.call_session.feedback.label);
        setFbNotes(data.call_session.feedback.notes || "");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unable to load call report.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;
    setFbSaving(true);
    setFbMessage(null);
    try {
      const isScam = fbLabel === "SCAM" ? true : fbLabel === "LEGITIMATE" ? false : null;
      await submitFeedback(report.call_id, {
        is_scam: isScam,
        label: fbLabel,
        notes: fbNotes,
      });
      await loadReport();
      await refreshReports();
      setFbMessage("Analyst ground-truth feedback saved to backend session.");
    } catch (err: unknown) {
      setFbMessage(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to save feedback."
      );
    } finally {
      setFbSaving(false);
    }
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.call_id}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <ErrorState
        title="Report Not Found"
        message={error || "No backend call report exists for this ID."}
        onRetry={() => void loadReport()}
      />
    );
  }

  const cs = report.call_session;
  const modeBadge =
    cs.execution_mode === "LIVE"
      ? "LIVE"
      : report.analysis_mode === "CACHED"
        ? "CACHED"
        : "DEMO";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/reports")}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Reports
          </Button>
          <div>
            <h1 className="page-title">{report.report_id}</h1>
            <p className="caption-text">
              Call {report.call_id} &bull; {report.caller_identity} &bull;{" "}
              {formatDate(report.generated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeBadge mode={modeBadge} />
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownloadJson}
            icon={<Download className="w-4 h-4" />}
          >
            Export JSON
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.print()}
            icon={<Printer className="w-4 h-4" />}
          >
            {copy.reports.printPdf}
          </Button>
        </div>
      </div>

      {/* Verdict Summary */}
      <Card
        variant={
          report.final_security_decision === "SAFE"
            ? "decision-continue"
            : report.final_security_decision === "THREAT"
              ? "decision-endcall"
              : "decision-stepup"
        }
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {report.final_security_decision === "SAFE" ? (
              <CheckCircle2 className="w-7 h-7 text-[var(--decision-continue-text)]" />
            ) : report.final_security_decision === "THREAT" ? (
              <XCircle className="w-7 h-7 text-[var(--decision-endcall-text)]" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-[var(--decision-stepup-text)]" />
            )}
            <div>
              <h2 className="section-title">
                Final Decision: {report.final_security_decision} ({cs.decision})
              </h2>
              <p className="body-text">{report.executive_summary}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[28px] font-bold font-mono text-[var(--text-primary)]">
              {report.composite_score !== null ? `${report.composite_score.toFixed(1)}/100` : "N/A"}
            </div>
            <div className="caption-text">Composite Trust Score</div>
          </div>
        </div>
      </Card>

      {/* 4-Layer Contribution Matrix */}
      <Card className="space-y-4">
        <h2 className="section-title">4-Layer Attribution & Scores</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cs.trust_breakdown.factor_contributions.map((fc) => (
            <div
              key={fc.key}
              className="p-4 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[14px] text-[var(--text-primary)]">
                  {fc.layer_name}
                </span>
                <Badge variant={fc.status === "PASS" ? "success" : fc.status === "FAIL" ? "danger" : "warning"}>
                  {fc.status}
                </Badge>
              </div>
              <div className="text-[20px] font-bold font-mono text-[var(--text-primary)]">
                {fc.raw_score !== null ? `${fc.raw_score.toFixed(1)}` : "—"}
              </div>
              <p className="caption-text">{fc.formula}</p>
              <p className="caption-text font-medium">
                Weight: {(fc.weight * 100).toFixed(0)}% &bull; +{fc.weighted_points.toFixed(1)} pts
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Transcript & Segment Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="space-y-3">
          <h2 className="section-title">Call Transcript ({cs.transcript.length} segments)</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {cs.transcript.map((seg) => (
              <div
                key={seg.id}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] space-y-1"
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {seg.speaker} @ {seg.timestamp_sec.toFixed(1)}s
                  </span>
                  <Badge
                    variant={
                      seg.risk_level === "HIGH"
                        ? "danger"
                        : seg.risk_level === "MEDIUM"
                          ? "warning"
                          : "success"
                    }
                  >
                    {seg.risk_level}
                  </Badge>
                </div>
                <p className="text-[14px] text-[var(--text-primary)]">{seg.text}</p>
                {seg.triggers.length > 0 && (
                  <p className="caption-text text-[var(--decision-endcall-text)]">
                    Triggers: {seg.triggers.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="section-title">Recommendations & Multilingual Summary</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-[var(--text-primary)]">
            {report.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
          <div className="pt-3 border-t border-[var(--border)] space-y-2">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Multilingual Verdicts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(report.multilingual_verdicts).map(([lang, text]) => (
                <div
                  key={lang}
                  className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)]"
                >
                  <div className="text-[12px] font-mono uppercase font-bold text-[var(--brand-steel)]">
                    {lang}
                  </div>
                  <div className="text-[13px] text-[var(--text-primary)]">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Analyst Ground-Truth Feedback */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[var(--brand-steel)]" />
          <h2 className="section-title">Analyst Ground-Truth Feedback (&ldquo;Was this a scam?&rdquo;)</h2>
        </div>

        {fbMessage && (
          <Banner variant="info" title="Feedback Status">
            {fbMessage}
          </Banner>
        )}

        <form onSubmit={handleSaveFeedback} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["SCAM", "LEGITIMATE", "UNCERTAIN"] as const).map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => setFbLabel(lbl)}
                className={`px-4 py-2 rounded-lg text-[14px] font-semibold border cursor-pointer transition-colors ${
                  fbLabel === lbl
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--fill-subtle)]"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <textarea
            value={fbNotes}
            onChange={(e) => setFbNotes(e.target.value)}
            rows={3}
            placeholder="Record verification outcome, fraud ring indicators, or operator notes..."
            className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text-primary)]"
          />

          <Button type="submit" variant="primary" disabled={fbSaving}>
            {fbSaving ? "Saving Feedback..." : "Save Ground-Truth Label"}
          </Button>
        </form>
      </Card>
    </div>
  );
};
