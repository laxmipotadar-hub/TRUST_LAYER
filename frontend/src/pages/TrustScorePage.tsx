import React, { useEffect, useState } from "react";
import { Sliders, ShieldCheck, Save, AlertTriangle } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Banner";
import { useAnalysis } from "../context/AnalysisContext";
import { aegisApi } from "../lib/api";

export const TrustScorePage: React.FC = () => {
  const { currentCall, callHistory, settings, refreshSystem } = useAnalysis();

  const [weights, setWeights] = useState<Record<string, number>>({
    voice_authenticity: 0.35,
    speaker_identity: 0.25,
    scam_intent: 0.25,
    behavioral_pressure: 0.15,
  });
  const [safeThreshold, setSafeThreshold] = useState(72);
  const [reviewThreshold, setReviewThreshold] = useState(45);
  const [emaAlpha, setEmaAlpha] = useState(0.6);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.layer_weights) setWeights(settings.layer_weights);
      setSafeThreshold(settings.safe_threshold);
      setReviewThreshold(settings.review_threshold);
      setEmaAlpha(settings.ema_alpha);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await aegisApi.updateSettings({
        layer_weights: weights,
        safe_threshold: safeThreshold,
        review_threshold: reviewThreshold,
        ema_alpha: emaAlpha,
      });
      await refreshSystem();
      setNotice("Fusion weights and EMA smoothing parameters saved to backend settings.");
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

  // Historical chart over callHistory (oldest -> newest)
  const historyPoints = [...callHistory].reverse().slice(-15);
  const chartW = 640;
  const chartH = 180;
  const polyScore = historyPoints
    .map((c, idx) => {
      const x =
        historyPoints.length <= 1
          ? chartW / 2
          : (idx / (historyPoints.length - 1)) * (chartW - 40) + 20;
      const val = c.trust_score ?? 0;
      const y = chartH - 20 - (Math.max(0, Math.min(100, val)) / 100) * (chartH - 40);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const yForVal = (v: number) => chartH - 20 - (v / 100) * (chartH - 40);

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

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)]">
          {historyPoints.length === 0 ? (
            <p className="caption-text">No analyzed sessions yet. Run Analyze or Live Demo to plot trajectory.</p>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-44 overflow-visible">
              {/* Threshold lines */}
              <line
                x1="20"
                y1={yForVal(safeThreshold)}
                x2={chartW - 20}
                y2={yForVal(safeThreshold)}
                stroke="var(--decision-continue-solid)"
                strokeDasharray="5 5"
              />
              <line
                x1="20"
                y1={yForVal(reviewThreshold)}
                x2={chartW - 20}
                y2={yForVal(reviewThreshold)}
                stroke="var(--decision-stepup-solid)"
                strokeDasharray="5 5"
              />
              <polyline
                fill="none"
                stroke="var(--brand-steel)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polyScore}
              />
              {historyPoints.map((c, idx) => {
                const x =
                  historyPoints.length <= 1
                    ? chartW / 2
                    : (idx / (historyPoints.length - 1)) * (chartW - 40) + 20;
                const val = c.trust_score ?? 0;
                const y = yForVal(val);
                return (
                  <g key={c.call_id}>
                    <circle cx={x} cy={y} r="5" fill="var(--brand-navy)" />
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--text-primary)"
                    >
                      {val.toFixed(0)}
                    </text>
                  </g>
                );
              })}
            </svg>
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
              { key: "scam_intent", label: "L3 Script Intent Weight" },
              { key: "behavioral_pressure", label: "L4 Manipulation Weight" },
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
                  onChange={(e) =>
                    setWeights((prev) => ({
                      ...prev,
                      [item.key]: Math.max(0, Math.min(1, Number(e.target.value))),
                    }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
                />
              </label>
            ))}
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

          <div className="flex items-center justify-between pt-2">
            <span className="caption-text flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[var(--decision-stepup-text)]" />
              Backend normalizes layer weights automatically if their sum differs from 1.00.
            </span>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              icon={<Save className="w-4 h-4" />}
            >
              {saving ? "Saving..." : "Save Fusion Settings"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
