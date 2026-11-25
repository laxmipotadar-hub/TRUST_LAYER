import { useState } from 'react';
import { Clock, Info } from 'lucide-react';
import type { CallSession, CallStateStage } from '../../types/aegis';
import { getVerdictStyle } from '../../utils/statusStyles';
import { AcousticWaveformCard } from '../charts/AcousticWaveformCard';
import { RiskProgressBar } from '../charts/RiskProgressBar';
import { TrustScoreRadialGauge } from '../charts/TrustScoreRadialGauge';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { AlertCard } from '../ui/AlertCard';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

interface CenterTrustPanelProps {
  call: CallSession;
  callStateStage: CallStateStage;
  isMonitoring: boolean;
}

const CALL_STAGES: { key: CallStateStage; label: string }[] = [
  { key: 'RINGING', label: 'RINGING' },
  { key: 'GREETING', label: 'GREETING' },
  { key: 'IDENTITY_CHECK', label: 'IDENTITY CHECK' },
  { key: 'CHALLENGE', label: 'CHALLENGE' },
  { key: 'CONVERSATION', label: 'CONVERSATION' },
  { key: 'VERDICT', label: 'VERDICT' },
];

function verdictTone(verdict: string): StatusTone {
  if (verdict === 'SAFE') return 'safe';
  if (verdict === 'THREAT') return 'threat';
  return 'caution';
}

export function CenterTrustPanel({
  call,
  callStateStage,
  isMonitoring,
}: CenterTrustPanelProps) {
  const { trust_breakdown: tb } = call;
  const finalVerdict = tb.final_decision || tb.verdict;
  const scoreVerdict = tb.score_based_verdict || tb.verdict;
  const accentHex = getVerdictStyle(finalVerdict).accentHex;

  const [selectedLayerKey, setSelectedLayerKey] = useState<string>(
    tb.factor_contributions[0]?.key ?? 'voice_authenticity',
  );
  const selectedLayer =
    tb.factor_contributions.find((f) => f.key === selectedLayerKey) ?? tb.factor_contributions[0];

  const chunks = call.segment_chunks ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* CENTERPIECE: RADIAL TRUST SCORE GAUGE + 4 WEIGHTED LAYERS */}
      <section
        className={`rounded-xl border bg-[#111827] p-4 ${
          finalVerdict === 'THREAT'
            ? 'animate-threat-escalation border-[#ef4444]/40'
            : 'border-slate-800/90'
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Live Trust Intelligence
            </h2>
            <ProvenanceBadge provenance={call.overall_provenance} compact />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={`SCORE: ${scoreVerdict}`} tone={verdictTone(scoreVerdict)} />
            <StatusBadge
              label={`FINAL: ${finalVerdict}`}
              tone={verdictTone(finalVerdict)}
              dot
              pulse={finalVerdict === 'THREAT'}
            />
          </div>
        </div>

        {/* Large Animated Radial Gauge + Disposition */}
        <div className="flex flex-col items-center rounded-lg border border-slate-800 bg-[#151e30] p-4">
          <TrustScoreRadialGauge
            score={tb.composite_score}
            verdict={finalVerdict}
            label="COMPOSITE TRUST"
            size={190}
          />

          <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center font-mono text-[11px]">
            <div className="rounded border border-slate-800 bg-[#0a0f1e]/70 px-2 py-1.5">
              <div className="text-[9px] text-[#94a3b8]">SCORE VERDICT</div>
              <div className="mt-0.5 font-semibold text-[#f8fafc]">{scoreVerdict}</div>
            </div>
            <div className="rounded border border-slate-800 bg-[#0a0f1e]/70 px-2 py-1.5">
              <div className="text-[9px] text-[#94a3b8]">LIVENESS</div>
              <div
                className={`mt-0.5 font-semibold ${
                  tb.liveness_status === 'PASSED'
                    ? 'text-[#22c55e]'
                    : tb.liveness_status === 'FAILED'
                      ? 'text-[#ef4444]'
                      : 'text-[#f59e0b]'
                }`}
              >
                {tb.liveness_status}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#0a0f1e]/70 px-2 py-1.5">
              <div className="text-[9px] text-[#94a3b8]">FINAL DISPOSITION</div>
              <div
                className={`mt-0.5 font-semibold ${
                  finalVerdict === 'SAFE'
                    ? 'text-[#22c55e]'
                    : finalVerdict === 'THREAT'
                      ? 'text-[#ef4444]'
                      : 'text-[#f59e0b]'
                }`}
              >
                {finalVerdict}
              </div>
            </div>
          </div>

          {tb.policy_override_applied && (
            <AlertCard
              className="mt-3 w-full"
              tone="threat"
              title="Challenge Liveness Override Applied"
              description={tb.policy_override_applied}
            />
          )}
        </div>

        {/* 4 Trust Score Layers */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">
            <span className="font-semibold uppercase tracking-wider">
              Four Trust Layers (Click layer for formula)
            </span>
            <span className="font-mono">35% · 30% · 20% · 15%</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tb.factor_contributions.map((layer) => {
              const isSelected = selectedLayer?.key === layer.key;
              const tone: StatusTone =
                layer.status === 'PASS'
                  ? 'safe'
                  : layer.status === 'FAIL'
                    ? 'threat'
                    : 'caution';
              return (
                <button
                  key={layer.key}
                  type="button"
                  onClick={() => setSelectedLayerKey(layer.key)}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-sky-500/60 bg-[#151e30] ring-1 ring-sky-500/30'
                      : 'border-slate-800 bg-[#151e30]/60 hover:border-slate-700'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-[#f8fafc]">
                      {layer.label}{' '}
                      <span className="font-mono text-[10px] text-sky-400">
                        ({Math.round(layer.weight * 100)}%)
                      </span>
                    </span>
                    <StatusBadge label={layer.status} tone={tone} />
                  </div>
                  <RiskProgressBar
                    label={`Contribution: +${layer.weighted_contribution.toFixed(2)}`}
                    value={layer.raw_score ?? 0}
                    invertRisk
                  />
                </button>
              );
            })}
          </div>

          {selectedLayer && (
            <div className="rounded-lg border border-slate-800 bg-[#0a0f1e]/90 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
                  <Info className="h-3.5 w-3.5" />
                  {selectedLayer.layer_name}
                </span>
                <span className="font-mono text-[11px] text-[#f8fafc]">
                  {selectedLayer.formula}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#94a3b8]">{selectedLayer.explanation}</p>
            </div>
          )}
        </div>
      </section>

      {/* CALL STATE TIMELINE */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-3.5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          Call State Timeline
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {CALL_STAGES.map((stage) => {
            const active = stage.key === callStateStage;
            return (
              <div
                key={stage.key}
                className={`rounded border px-2 py-1.5 text-center font-mono text-[10px] font-semibold transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                    : 'border-slate-800 bg-[#151e30]/60 text-[#94a3b8]'
                }`}
              >
                {stage.label}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5-SECOND SEGMENT EVIDENCE TIMELINE */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <Clock className="h-3.5 w-3.5 text-sky-400" />
            5-Second Segment Evidence Timeline
          </div>
          <span className="font-mono text-[10px] text-[#94a3b8]">
            {chunks.length > 0 ? `${chunks.length} Evaluated Segments` : 'No Segment Chunks'}
          </span>
        </div>

        {chunks.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {chunks.map((chunk) => {
              const toneColor =
                chunk.risk_level === 'HIGH'
                  ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]'
                  : chunk.risk_level === 'MEDIUM'
                    ? 'border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]'
                    : 'border-[#22c55e]/35 bg-[#22c55e]/10 text-[#22c55e]';

              return (
                <div
                  key={chunk.chunk_index}
                  className={`rounded-lg border p-2.5 transition-colors ${toneColor}`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] font-semibold">
                    <span>
                      {chunk.start_sec.toFixed(0)}s – {chunk.end_sec.toFixed(0)}s
                    </span>
                    <span>{chunk.risk_level}</span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#f8fafc]">{chunk.label}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[#94a3b8]">
            Segment-level 5s telemetry appears when audio segment results are returned by Aletheia or
            scenario fixtures.
          </p>
        )}
      </section>

      <AcousticWaveformCard
        profile={call.audio_profile}
        isMonitoring={isMonitoring}
        verdictColorHex={accentHex}
      />
    </div>
  );
}
