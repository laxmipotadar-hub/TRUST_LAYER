import { useState } from 'react';
import { Info } from 'lucide-react';
import type { CallActionType, CallSession } from '../../types/aegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { ActionButton } from '../ui/ActionButton';
import { AlertCard } from '../ui/AlertCard';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { Tooltip } from '../ui/Tooltip';
import { RiskProgressBar } from './RiskProgressBar';
import { SpeakerMatchRing } from './SpeakerMatchRing';
import { TrustScoreRadialGauge } from './TrustScoreRadialGauge';

interface TrustScorePanelProps {
  call: CallSession;
  onAction?: (action: CallActionType) => void;
}

function verdictTone(verdict: string): StatusTone {
  if (verdict === 'SAFE') return 'safe';
  if (verdict === 'THREAT') return 'threat';
  return 'caution';
}

export function TrustScorePanel({ call, onAction }: TrustScorePanelProps) {
  const { trust_breakdown: tb, speaker_identity: id } = call;
  const finalVerdict = tb.final_decision || tb.verdict;
  const scoreVerdict = tb.score_based_verdict || tb.verdict;

  const [selectedLayerKey, setSelectedLayerKey] = useState<string>(
    tb.factor_contributions[0]?.key ?? 'voice_authenticity',
  );

  const selectedLayer =
    tb.factor_contributions.find((f) => f.key === selectedLayerKey) ?? tb.factor_contributions[0];

  return (
    <section
      className={`rounded-xl border bg-[#111827] p-4 lg:p-5 ${
        finalVerdict === 'THREAT' ? 'animate-threat-escalation border-[#ef4444]/40' : 'border-slate-800/90'
      }`}
    >
      {/* Header Row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              Composite Call Trust &amp; Security Disposition
            </h2>
            <ProvenanceBadge provenance={call.overall_provenance} compact />
          </div>
          <p className="mt-0.5 text-xs text-[#94a3b8]">
            Session <span className="font-mono text-[#f8fafc]">{call.call_id}</span> · Caller:{' '}
            <span className="font-medium text-[#f8fafc]">{call.caller_label}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Pure mathematical verdict derived strictly from the 4-layer weighted formula">
            <span>
              <StatusBadge label={`SCORE: ${scoreVerdict}`} tone={verdictTone(scoreVerdict)} size="md" />
            </span>
          </Tooltip>
          <StatusBadge
            label={`DECISION: ${finalVerdict}`}
            tone={verdictTone(finalVerdict)}
            dot
            pulse={finalVerdict === 'THREAT'}
            size="md"
          />
        </div>
      </div>

      {/* Main 12-Col Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Trust Score Radial Gauge + Speaker Match Ring */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-[#151e30] p-4 lg:col-span-4">
          <div className="flex items-center justify-around gap-3">
            <TrustScoreRadialGauge score={tb.composite_score} verdict={finalVerdict} />

            <div className="flex flex-col items-center text-center">
              <SpeakerMatchRing percentage={id.score} enrolled={id.enrolled !== false} />
              <span className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
                Eidos Match
              </span>
              <span className="mt-0.5 font-mono text-[10px] text-[#f8fafc]">
                {id.enrolled === false ? 'Neutral (50)' : id.claimed_customer_id}
              </span>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-3">
            <RiskProgressBar
              label="Scam-Script Risk"
              value={call.scam_analysis.risk_score}
              sublabel={`Engine: ${call.scam_analysis.engine_used}`}
            />
            <RiskProgressBar
              label="Behavioral Pressure"
              value={call.scam_analysis.behavioral_pressure_score}
            />
          </div>
        </div>

        {/* Right: Interactive 4-Layer Explainability & Actions */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-[#151e30] p-4 lg:col-span-8">
          <div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                4-Layer Trust Breakdown (Select layer to inspect formula &amp; evidence)
              </h3>
              <span className="font-mono text-[11px] text-[#94a3b8]">
                Liveness:{' '}
                <strong
                  className={
                    tb.liveness_status === 'PASSED'
                      ? 'text-[#22c55e]'
                      : tb.liveness_status === 'FAILED'
                        ? 'text-[#ef4444]'
                        : 'text-[#f59e0b]'
                  }
                >
                  {tb.liveness_status}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tb.factor_contributions.map((layer) => {
                const isSelected = layer.key === selectedLayer?.key;
                const layerTone: StatusTone =
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
                        ? 'border-sky-500/60 bg-[#0a0f1e] ring-1 ring-sky-500/30'
                        : 'border-slate-800 bg-[#0a0f1e]/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                        {layer.label}
                      </span>
                      <span className="font-mono text-[10px] text-sky-400">
                        {Math.round(layer.weight * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-mono text-sm font-bold tabular-nums text-[#f8fafc]">
                        +{layer.weighted_contribution.toFixed(2)}
                      </span>
                      <StatusBadge label={layer.status} tone={layerTone} />
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedLayer && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-[#0a0f1e]/85 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                    <Info className="h-3.5 w-3.5" />
                    {selectedLayer.layer_name || selectedLayer.label}
                  </div>
                  <span className="font-mono text-xs text-[#f8fafc]">
                    Contribution: <strong className="text-sky-300">{selectedLayer.weighted_contribution.toFixed(2)}</strong>
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded border border-slate-800 bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] text-[#f8fafc]">
                    <span className="text-[#94a3b8]">{selectedLayer.input_label}: </span>
                    {selectedLayer.input_value !== null ? selectedLayer.input_value : 'N/A'}
                  </div>
                  <div className="rounded border border-slate-800 bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] text-sky-200">
                    <span className="text-[#94a3b8]">Formula: </span>
                    {selectedLayer.formula}
                  </div>
                </div>

                <p className="mt-2 text-xs text-[#94a3b8]">{selectedLayer.explanation}</p>

                {selectedLayer.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
                    {selectedLayer.evidence.map((ev, idx) => (
                      <li key={idx} className="text-[11px] text-[#f8fafc]">
                        • {ev}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            {tb.policy_override_applied && (
              <AlertCard
                tone="threat"
                title="Challenge Liveness / Security Policy Override"
                description={tb.policy_override_applied}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
              <div className="text-xs text-[#94a3b8]">
                <span className="font-semibold text-[#f8fafc]">Guidance: </span>
                {tb.recommended_action}
              </div>

              {onAction && (
                <div className="flex flex-wrap gap-2">
                  <ActionButton variant="safe" onClick={() => onAction('ALLOW')}>
                    Allow Call
                  </ActionButton>
                  <ActionButton variant="caution" onClick={() => onAction('STEP_UP_CHALLENGE')}>
                    Step-Up Challenge
                  </ActionButton>
                  <ActionButton variant="threat" onClick={() => onAction('FREEZE_ACCOUNT')}>
                    Freeze &amp; Escalate
                  </ActionButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
