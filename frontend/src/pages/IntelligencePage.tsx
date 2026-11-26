import React, { useMemo, useState } from "react";
import { FileSearch, Activity, Code2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ModeBadge } from "../components/ui/ModeBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { useAnalysis } from "../context/AnalysisContext";
import { aegisApi } from "../lib/api";
import type { CallSession } from "../types";

export const IntelligencePage: React.FC = () => {
  const { currentCall, callHistory, executionMode, applyUpdatedCall } = useAnalysis();
  const [selectedCallId, setSelectedCallId] = useState<string>("");
  const [showRawJson, setShowRawJson] = useState(false);
  const [probeTranscript, setProbeTranscript] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const activeCall: CallSession | null = useMemo(() => {
    if (selectedCallId) {
      return callHistory.find((c) => c.call_id === selectedCallId) || currentCall;
    }
    return currentCall || callHistory[0] || null;
  }, [selectedCallId, callHistory, currentCall]);

  const handleAnalyzeTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!probeTranscript.trim()) return;
    setProbing(true);
    setProbeError(null);
    try {
      const res = await aegisApi.analyzeCall({
        transcript_text: probeTranscript.trim(),
        claimed_customer_id: activeCall?.claimed_customer_id || "CUST-4821-MARCUS",
        caller_label: "Transcript Probe",
        execution_mode: executionMode,
      });
      applyUpdatedCall(res.session);
      setSelectedCallId(res.call_id);
    } catch (err: unknown) {
      setProbeError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Transcript analysis failed."
      );
    } finally {
      setProbing(false);
    }
  };

  if (!activeCall) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Script &amp; Manipulation Intelligence</h1>
          <p className="body-text">
            Layer 3 Script Intent (Groq Whisper + LLM / Rules) and Layer 4 Behavioral Manipulation marker telemetry.
          </p>
        </div>
        <EmptyState
          icon={<FileSearch className="w-8 h-8" />}
          title="No Call Session Selected"
          description="Analyze an incoming call or run the Live Demo to inspect script triggers and behavioral manipulation markers."
        />
      </div>
    );
  }

  const scam = activeCall.scam_analysis;
  const manip = activeCall.manipulation_analysis;
  const sparkPoints =
    manip.sparkline.length > 0 ? manip.sparkline : manip.score !== null ? [manip.score] : [0];
  const svgWidth = 360;
  const svgHeight = 80;
  const polylinePts = sparkPoints
    .map((val, idx) => {
      const x =
        sparkPoints.length === 1
          ? svgWidth / 2
          : (idx / (sparkPoints.length - 1)) * (svgWidth - 16) + 8;
      const y = svgHeight - 8 - (Math.max(0, Math.min(100, val)) / 100) * (svgHeight - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Script &amp; Manipulation Intelligence</h1>
          <p className="body-text">
            Deep inspection of Layer 3 Script Intent (Groq Whisper + LLM) and Layer 4 Psychological Pressure telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {callHistory.length > 0 && (
            <select
              value={activeCall.call_id}
              onChange={(e) => setSelectedCallId(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
            >
              {callHistory.map((c) => (
                <option key={c.call_id} value={c.call_id}>
                  {c.call_id} — {c.caller_label} ({c.verdict})
                </option>
              ))}
            </select>
          )}
          <ModeBadge
            mode={
              activeCall.execution_mode === "LIVE"
                ? "LIVE"
                : activeCall.analysis_mode === "CACHED"
                  ? "CACHED"
                  : "DEMO"
            }
          />
        </div>
      </div>

      {/* Ad-hoc Transcript Probe */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--brand-steel)]" />
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Run Live Transcript Probe ({executionMode} Mode)
          </h2>
        </div>
        <form onSubmit={handleAnalyzeTranscript} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={probeTranscript}
            onChange={(e) => setProbeTranscript(e.target.value)}
            placeholder="Paste spoken transcript excerpt (e.g. Read back your 6-digit OTP immediately or your account freezes)..."
            className="flex-1 h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
          />
          <Button type="submit" variant="primary" disabled={probing || !probeTranscript.trim()}>
            {probing ? "Analyzing..." : "Analyze Transcript"}
          </Button>
        </form>
        {probeError && (
          <p className="text-[14px] text-[var(--decision-endcall-text)] font-medium">{probeError}</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Layer 3 Script Analysis */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-[var(--brand-steel)]" />
              <h2 className="section-title">L3: Script Analysis ({scam.engine_used})</h2>
            </div>
            <Badge
              variant={
                scam.risk_score === null
                  ? "neutral"
                  : scam.risk_score >= 65
                    ? "danger"
                    : scam.risk_score >= 30
                      ? "warning"
                      : "success"
              }
            >
              {scam.risk_score !== null ? `Risk ${scam.risk_score.toFixed(1)}/100` : "Unavailable"}
            </Badge>
          </div>

          <p className="body-text">{scam.summary}</p>

          <div className="flex flex-wrap gap-2">
            {scam.categories.length === 0 ? (
              <Badge variant="success">No Scam Category Detected</Badge>
            ) : (
              scam.categories.map((cat) => (
                <Badge key={cat} variant="danger">
                  {cat}
                </Badge>
              ))
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Highlighted Transcript &amp; Evidence
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeCall.transcript.map((seg) => (
                <div
                  key={seg.id}
                  className={`p-3 rounded-lg border ${
                    seg.risk_level === "HIGH"
                      ? "bg-[var(--decision-endcall-tint)] border-[var(--decision-endcall-border)]"
                      : seg.risk_level === "MEDIUM"
                        ? "bg-[var(--decision-stepup-tint)] border-[var(--decision-stepup-border)]"
                        : "bg-[var(--fill-subtle)] border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span className="font-semibold">
                      {seg.speaker} &bull; {seg.timestamp_sec.toFixed(1)}s
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
                    <p className="caption-text mt-1 font-medium">
                      Matched indicators: {seg.triggers.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {scam.flagged_phrases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                Matched Script Rules ({scam.flagged_phrases.length})
              </h3>
              <div className="space-y-1.5">
                {scam.flagged_phrases.map((fp, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                        &ldquo;{fp.phrase}&rdquo; ({fp.category})
                      </div>
                      <div className="caption-text">{fp.explanation}</div>
                    </div>
                    <Badge variant={fp.severity === "HIGH" ? "danger" : "warning"}>
                      +{fp.weight}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Layer 4 Manipulation Analysis */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--brand-steel)]" />
              <h2 className="section-title">L4: Manipulation &amp; Pressure Analysis</h2>
            </div>
            <Badge
              variant={
                manip.score === null
                  ? "neutral"
                  : manip.score >= 60
                    ? "danger"
                    : manip.score >= 25
                      ? "warning"
                      : "success"
              }
            >
              {manip.score !== null ? `Pressure ${manip.score.toFixed(1)}/100` : "Unavailable"}
            </Badge>
          </div>

          {/* Category Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["urgency", "secrecy", "authority", "threat"] as const).map((cat) => (
              <div
                key={cat}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] text-center"
              >
                <div className="text-[12px] uppercase font-bold text-[var(--text-secondary)]">
                  {cat}
                </div>
                <div className="text-[22px] font-bold font-mono text-[var(--text-primary)]">
                  {manip.category_counts[cat] ?? 0}
                </div>
              </div>
            ))}
          </div>

          {/* SVG Sparkline */}
          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
            <div className="flex items-center justify-between text-[13px] font-semibold text-[var(--text-secondary)]">
              <span>Psychological Pressure Progression Sparkline</span>
              <span>{sparkPoints.length} samples</span>
            </div>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-20 overflow-visible">
              <line
                x1="0"
                y1={svgHeight / 2}
                x2={svgWidth}
                y2={svgHeight / 2}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <polyline
                fill="none"
                stroke="var(--brand-steel)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePts}
              />
            </svg>
          </div>

          {/* Markers Timeline */}
          <div className="space-y-2">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Detected Behavioral Markers ({manip.markers.length})
            </h3>
            {manip.markers.length === 0 ? (
              <p className="caption-text">No coercive manipulation markers detected in this call.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {manip.markers.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-bold uppercase text-[var(--brand-steel)]">
                        {m.category} &bull; {m.timestamp_sec.toFixed(1)}s
                      </span>
                      <Badge variant={m.severity === "HIGH" ? "danger" : "warning"}>
                        {m.severity} (+{m.weight})
                      </Badge>
                    </div>
                    <p className="text-[14px] font-medium text-[var(--text-primary)]">
                      Phrase: &ldquo;{m.phrase}&rdquo;
                    </p>
                    <p className="caption-text">{m.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Collapsible Raw Layer Payloads */}
      <Card className="space-y-3">
        <button
          type="button"
          onClick={() => setShowRawJson((v) => !v)}
          className="flex items-center justify-between w-full text-left cursor-pointer"
        >
          <span className="flex items-center gap-2 font-semibold text-[15px] text-[var(--text-primary)]">
            <Code2 className="w-4 h-4 text-[var(--brand-steel)]" />
            Raw Layer 3 &amp; Layer 4 Inspection Payloads
          </span>
          {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showRawJson && (
          <pre className="p-4 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] overflow-x-auto text-[12px] font-mono text-[var(--text-primary)]">
            {JSON.stringify(
              {
                scam_analysis: scam,
                manipulation_analysis: manip,
              },
              null,
              2
            )}
          </pre>
        )}
      </Card>
    </div>
  );
};
