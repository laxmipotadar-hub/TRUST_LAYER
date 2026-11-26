import React, { useEffect, useState } from "react";
import { Sliders, ShieldCheck, Save, AlertTriangle, RotateCcw } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Banner";
import { useAnalysis } from "../context/AnalysisContext";
import { aegisApi } from "../lib/api";

export const DEFAULT_FUSION_WEIGHTS = {
  voice_authenticity: 0.35,
  speaker_identity: 0.3,
  scam_safety: 0.2,
  behavioral_safety: 0.15,
};

export function normalizeWeightMap(raw?: Record<string, number> | null): Record<string, number> {
  const src = raw || {};
  const mapped: Record<string, number> = {
    voice_authenticity:
      typeof src.voice_authenticity === "number" && Number.isFinite(src.voice_authenticity)
        ? Math.max(0, src.voice_authenticity)
        : DEFAULT_FUSION_WEIGHTS.voice_authenticity,
    speaker_identity:
      typeof src.speaker_identity === "number" && Number.isFinite(src.speaker_identity)
        ? Math.max(0, src.speaker_identity)
        : DEFAULT_FUSION_WEIGHTS.speaker_identity,
    scam_safety:
      typeof src.scam_safety === "number" && Number.isFinite(src.scam_safety)
        ? Math.max(0, src.scam_safety)
        : typeof src.scam_intent === "number" && Number.isFinite(src.scam_intent)
        ? Math.max(0, src.scam_intent)
        : DEFAULT_FUSION_WEIGHTS.scam_safety,
    behavioral_safety:
      typeof src.behavioral_safety === "number" && Number.isFinite(src.behavioral_safety)
        ? Math.max(0, src.behavioral_safety)
        : typeof src.behavioral_pressure === "number" && Number.isFinite(src.behavioral_pressure)
        ? Math.max(0, src.behavioral_pressure)
        : DEFAULT_FUSION_WEIGHTS.behavioral_safety,
  };
  return mapped;
}

export const TrustScorePage: React.FC = () => {
  const { currentCall, callHistory, settings, refreshSystem } = useAnalysis();

  const [weights, setWeights] = useState<Record<string, number>>({ ...DEFAULT_FUSION_WEIGHTS });
  const [safeThreshold, setSafeThreshold] = useState(75);
  const [reviewThreshold, setReviewThreshold] = useState(40);
  const [emaAlpha, setEmaAlpha] = useState(0.45);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmZeroL3L4, setConfirmZeroL3L4] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.layer_weights) setWeights(normalizeWeightMap(settings.layer_weights));
      setSafeThreshold(settings.safe_threshold);
      setReviewThreshold(settings.review_threshold);
      setEmaAlpha(settings.ema_alpha);
    }
  }, [settings]);

  const rawWeightSum =
    (weights.voice_authenticity || 0) +
    (weights.speaker_identity || 0) +
    (weights.scam_safety || 0) +
    (weights.behavioral_safety || 0);
  const normalizedWeights =
    rawWeightSum > 0
      ? {
          voice_authenticity: (weights.voice_authenticity || 0) / rawWeightSum,
          speaker_identity: (weights.speaker_identity || 0) / rawWeightSum,
          scam_safety: (weights.scam_safety || 0) / rawWeightSum,
          behavioral_safety: (weights.behavioral_safety || 0) / rawWeightSum,
        }
      : { ...DEFAULT_FUSION_WEIGHTS };

  const bothL3L4Zero = (weights.scam_safety || 0) === 0 && (weights.behavioral_safety || 0) === 0;

  const persistSettings = async (
    nextWeights = weights,
    nextSafe = safeThreshold,
    nextReview = reviewThreshold,
    nextEma = emaAlpha,
    successMsg = "Fusion weights and EMA smoothing parameters saved to backend settings."
  ) => {
    setSaving(true);
    setNotice(null);
    setConfirmZeroL3L4(false);
    try {
      await aegisApi.updateSettings({
        layer_weights: nextWeights,
        safe_threshold: nextSafe,
        review_threshold: nextReview,
        ema_alpha: nextEma,
      });
      await refreshSystem();
      setNotice(successMsg);
    } catch (err: unknown) {
      setNotice(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to save fusion settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rawWeightSum <= 0) {
      setNotice("At least one layer weight must be greater than 0.");
      return;
    }
    if (bothL3L4Zero && !confirmZeroL3L4) {
      setConfirmZeroL3L4(true);
      setNotice(
        "L3 Script Safety and L4 Manipulation weights are both 0.00. Confirm below if you intentionally want to ignore transcript risk."
      );
      return;
    }
    await persistSettings();
  };

  const handleResetDefaults = async () => {
    const def = { ...DEFAULT_FUSION_WEIGHTS };
    setWeights(def);
    setSafeThreshold(75);
    setReviewThreshold(40);
    setEmaAlpha(0.45);
    await persistSettings(
      def,
      75,
      40,
      0.45,
      "Reset fusion weights to defaults (0.35 / 0.30 / 0.20 / 0.15) and saved."
    );
  };

  // Historical chart over callHistory (oldest -> newest)
  const historyPoints = [...callHistory].reverse().slice(-15);
  const chartW = 640;
  const chartH = 205;
  const padX = 28;
  const topY = 18;
  const scoreBottomY = 160;
  const unavailY = 186;
  const yForVal = (v: number) =>
    scoreBottomY - (Math.max(0, Math.min(100, v)) / 100) * (scoreBottomY - topY);

  const chartNodes = historyPoints.map((c, idx) => {
    const x =
      historyPoints.length <= 1
        ? chartW / 2
        : (idx / (historyPoints.length - 1)) * (chartW - padX * 2) + padX;
    const isUnavailable = c.trust_score === null || c.trust_score === undefined;
    const missingLayers: string[] = [];
    if (c.voice_authenticity?.status === "UNAVAILABLE") missingLayers.push("L1 Aletheia unavailable");
    if (c.speaker_identity?.status === "UNAVAILABLE") missingLayers.push("L2 Eidos unavailable");
    if (c.scam_analysis?.status === "UNAVAILABLE") missingLayers.push("L3 Script unavailable");
    if (c.manipulation_analysis?.status === "UNAVAILABLE") missingLayers.push("L4 Manipulation unavailable");
    const isPartial = !isUnavailable && missingLayers.length > 0;
    const isEndCall = c.decision === "END_CALL" || c.decision === "BLOCK";
    const y = isUnavailable ? unavailY : yForVal(c.trust_score as number);
    const reason = isUnavailable
      ? `Unavailable (${missingLayers.join(", ") || c.decision_reason || c.verdict})`
      : isPartial
      ? `Partial score ${(c.trust_score as number).toFixed(1)} (${missingLayers.join(", ")})`
      : `${c.decision} — Trust Score ${(c.trust_score as number).toFixed(1)}`;
    return { call: c, x, y, isUnavailable, isPartial, isEndCall, reason };
  });

  // Build polyline segments only across numeric scores (break line across unavailable gaps)
  const polylineSegments: string[] = [];
  let activeSeg: string[] = [];
  for (const node of chartNodes) {
    if (node.isUnavailable) {
      if (activeSeg.length > 1) polylineSegments.push(activeSeg.join(" "));
      activeSeg = [];
    } else {
      activeSeg.push(`${node.x.toFixed(1)},${node.y.toFixed(1)}`);
    }
  }
  if (activeSeg.length > 1) polylineSegments.push(activeSeg.join(" "));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Composite Trust Score Fusion Engine</h1>
        <p className="body-text">
          Weighted 4-layer trust scoring, EMA temporal smoothing, conflict override audit, and
          threshold tuning.
        </p>
      </div>

      {/* Historical Trust Score SVG Chart */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--brand-steel)]" />
            <h2 className="section-title">Historical Composite Trust Trajectory</h2>
          </div>
          <span className="caption-text">
            Showing {historyPoints.length} recent call session(s) &bull; SAFE &ge; {safeThreshold} &bull; REVIEW &ge; {reviewThreshold}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
          {historyPoints.length === 0 ? (
            <p className="caption-text">No analyzed sessions yet. Run Analyze or Live Demo to plot trajectory.</p>
          ) : (
            <>
              <div className="relative">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-48 overflow-visible">
                  {/* SAFE & REVIEW threshold lines */}
                  <line
                    x1={padX}
                    y1={yForVal(safeThreshold)}
                    x2={chartW - padX}
                    y2={yForVal(safeThreshold)}
                    stroke="var(--decision-continue-solid)"
                    strokeDasharray="5 5"
                  />
                  <text x={padX} y={yForVal(safeThreshold) - 4} fontSize="10" fill="var(--decision-continue-text)">
                    SAFE ({safeThreshold})
                  </text>
                  <line
                    x1={padX}
                    y1={yForVal(reviewThreshold)}
                    x2={chartW - padX}
                    y2={yForVal(reviewThreshold)}
                    stroke="var(--decision-stepup-solid)"
                    strokeDasharray="5 5"
                  />
                  <text x={padX} y={yForVal(reviewThreshold) - 4} fontSize="10" fill="var(--decision-stepup-text)">
                    REVIEW ({reviewThreshold})
                  </text>
                  <line
                    x1={padX}
                    y1={unavailY}
                    x2={chartW - padX}
                    y2={unavailY}
                    stroke="var(--border)"
                    strokeDasharray="2 4"
                  />
                  <text x={padX} y={unavailY - 6} fontSize="10" fill="var(--text-muted)">
                    UNAVAILABLE
                  </text>

                  {polylineSegments.map((pts, i) => (
                    <polyline
                      key={i}
                      fill="none"
                      stroke="var(--brand-steel)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pts}
                    />
                  ))}
                  {chartNodes.map((node, idx) => (
                    <g
                      key={node.call.call_id}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx((prev) => (prev === idx ? null : prev))}
                      tabIndex={0}
                      onFocus={() => setHoveredIdx(idx)}
                      onBlur={() => setHoveredIdx((prev) => (prev === idx ? null : prev))}
                      className="cursor-pointer outline-none"
                    >
                      <title>{`${node.call.call_id}: ${node.reason}`}</title>
                      {node.isUnavailable ? (
                        <>
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r="6"
                            fill="var(--surface)"
                            stroke="var(--decision-stepup-solid)"
                            strokeWidth="2.5"
                            strokeDasharray="2 2"
                          />
                          <text x={node.x} y={node.y - 10} textAnchor="middle" fontSize="10" fill="var(--decision-stepup-text)">
                            N/A
                          </text>
                        </>
                      ) : (
                        <>
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.isEndCall ? 6 : 5}
                            fill={
                              node.isEndCall
                                ? "var(--decision-endcall-solid)"
                                : node.isPartial
                                ? "var(--surface)"
                                : "var(--brand-navy)"
                            }
                            stroke={node.isPartial ? "var(--decision-stepup-solid)" : "none"}
                            strokeWidth={node.isPartial ? 2.5 : 0}
                          />
                          <text x={node.x} y={node.y - 10} textAnchor="middle" fontSize="11" fill="var(--text-primary)">
                            {(node.call.trust_score as number).toFixed(0)}
                          </text>
                        </>
                      )}
                    </g>
                  ))}
                </svg>
                {hoveredIdx !== null && chartNodes[hoveredIdx] && (
                  <div className="mt-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text-primary)]">
                    <span className="font-mono font-semibold">{chartNodes[hoveredIdx].call.call_id}</span>:{" "}
                    {chartNodes[hoveredIdx].reason}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-[12px] text-[var(--text-muted)]">
                <span>● Solid Navy: Verified score</span>
                <span className="text-[var(--decision-endcall-text)]">● Red: Real END_CALL / BLOCK score</span>
                <span className="text-[var(--decision-stepup-text)]">○ Hollow Ring: Unavailable / Partial layer</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Current Session Breakdown */}
      {currentCall && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">
                Active Call Breakdown ({currentCall.call_id})
              </h2>
              <p className="caption-text">{currentCall.trust_breakdown.formula_summary}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={currentCall.band === "SAFE" ? "success" : currentCall.band === "THREAT" ? "danger" : "warning"}>
                Band: {currentCall.band}
              </Badge>
              <Badge variant="info">Decision: {currentCall.decision}</Badge>
            </div>
          </div>

          {currentCall.trust_breakdown.conflict_overrides &&
            currentCall.trust_breakdown.conflict_overrides.length > 0 && (
              <Banner variant="error" title="Active Conflict / Policy Overrides">
                {currentCall.trust_breakdown.conflict_overrides.join(" | ")}
              </Banner>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentCall.trust_breakdown.factor_contributions.map((fc) => (
              <div
                key={fc.key}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[14px] text-[var(--text-primary)]">
                    {fc.label}
                  </span>
                  <Badge variant={fc.status === "PASS" ? "success" : fc.status === "FAIL" ? "danger" : "warning"}>
                    {fc.status}
                  </Badge>
                </div>
                <div className="text-[22px] font-bold font-mono text-[var(--text-primary)]">
                  {fc.weighted_points.toFixed(1)} pts
                </div>
                <div className="caption-text">{fc.formula}</div>
                <div className="caption-text">{fc.explanation}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Configurable Weights & EMA Form */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-[var(--brand-steel)]" />
          <h2 className="section-title">Editable Fusion Weights &amp; EMA Smoothing</h2>
        </div>

        {notice && (
          <Banner variant="info" title="Configuration Update">
            {notice}
          </Banner>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: "voice_authenticity", label: "L1 Voice Authenticity Weight" },
              { key: "speaker_identity", label: "L2 Speaker Identity Weight" },
              { key: "scam_safety", label: "L3 Script Safety Weight" },
              { key: "behavioral_safety", label: "L4 Behavioral Safety Weight" },
            ].map((item) => (
              <label key={item.key} className="block space-y-1.5">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {item.label} ({(weights[item.key] ?? 0).toFixed(2)})
                </span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[item.key] ?? 0}
                  onChange={(e) => {
                    const parsed = e.target.value === "" ? 0 : Number(e.target.value);
                    const safeVal = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
                    setConfirmZeroL3L4(false);
                    setWeights((prev) => ({
                      ...prev,
                      [item.key]: safeVal,
                    }));
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
                />
              </label>
            ))}
          </div>

          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] text-[14px] flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--text-primary)]">
              Normalized effective weights (sum = 1.00):
            </span>
            <span className="font-mono text-[var(--text-secondary)]">
              L1 {(normalizedWeights.voice_authenticity * 100).toFixed(0)}% &middot; L2{" "}
              {(normalizedWeights.speaker_identity * 100).toFixed(0)}% &middot; L3{" "}
              {(normalizedWeights.scam_safety * 100).toFixed(0)}% &middot; L4{" "}
              {(normalizedWeights.behavioral_safety * 100).toFixed(0)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1.5">
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                SAFE Band Threshold (&ge; {safeThreshold})
              </span>
              <input
                type="number"
                min={50}
                max={95}
                value={safeThreshold}
                onChange={(e) => setSafeThreshold(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                REVIEW Band Threshold (&ge; {reviewThreshold})
              </span>
              <input
                type="number"
                min={10}
                max={safeThreshold - 5}
                value={reviewThreshold}
                onChange={(e) => setReviewThreshold(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                EMA Smoothing Alpha ({emaAlpha.toFixed(2)})
              </span>
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.05}
                value={emaAlpha}
                onChange={(e) => setEmaAlpha(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
              />
            </label>
          </div>

          {confirmZeroL3L4 && (
            <Banner variant="warn" title="Confirm Zero Transcript Weights">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Both L3 Script Safety and L4 Behavioral Safety weights are set to 0.00. Confirm to save anyway.
                </span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmZeroL3L4(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => void persistSettings()}>
                    Confirm Save (L3/L4 = 0)
                  </Button>
                </div>
              </div>
            </Banner>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="caption-text flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[var(--decision-stepup-text)]" />
              Backend normalizes layer weights automatically if their sum differs from 1.00.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void handleResetDefaults()}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Reset to defaults
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                icon={<Save className="w-4 h-4" />}
              >
                {saving ? "Saving..." : "Save Fusion Settings"}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};
