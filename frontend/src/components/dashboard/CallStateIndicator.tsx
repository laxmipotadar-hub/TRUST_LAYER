import { CheckCircle2, Loader2, PhoneIncoming, ShieldAlert } from 'lucide-react';
import type { CallSession } from '../../types/aegis';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

interface CallStateIndicatorProps {
  call: CallSession | null;
  isMonitoring: boolean;
  isAnalyzing: boolean;
}

export function CallStateIndicator({
  call,
  isMonitoring,
  isAnalyzing,
}: CallStateIndicatorProps) {
  let stateLabel = 'STANDBY';
  let tone: StatusTone = 'neutral';

  if (isAnalyzing) {
    stateLabel = 'VERIFYING TELEMETRY';
    tone = 'info';
  } else if (isMonitoring) {
    stateLabel = 'LIVE MONITORING';
    tone = 'safe';
  } else if (call) {
    const verdict = call.trust_breakdown.final_decision || call.trust_breakdown.verdict;
    if (verdict === 'THREAT') {
      stateLabel = 'THREAT ESCALATED';
      tone = 'threat';
    } else if (verdict === 'CAUTION' || verdict === 'INCOMPLETE ANALYSIS') {
      stateLabel = 'STEP-UP REQUIRED';
      tone = 'caution';
    } else {
      stateLabel = 'CALL VERIFIED';
      tone = 'safe';
    }
  }

  const steps = call
    ? [
        { label: 'Voice', ok: call.voice_authenticity.status === 'PASS' },
        { label: 'Identity', ok: call.speaker_identity.status === 'PASS' },
        { label: 'Liveness', ok: call.liveness.passed },
        { label: 'Language', ok: call.scam_analysis.risk_score < 40 },
      ]
    : [
        { label: 'Voice', ok: false },
        { label: 'Identity', ok: false },
        { label: 'Liveness', ok: false },
        { label: 'Language', ok: false },
      ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-[#111827] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#151e30] text-sky-400">
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : tone === 'threat' ? (
            <ShieldAlert className="h-4 w-4 text-[#ef4444]" />
          ) : (
            <PhoneIncoming className="h-4 w-4" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge
              label={stateLabel}
              tone={tone}
              dot
              pulse={isMonitoring || isAnalyzing || tone === 'threat'}
            />
            {call && (
              <span className="font-mono text-xs text-[#94a3b8]">
                {call.call_id} · {call.claimed_customer_id}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Verification Progress Strip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
          Pipeline:
        </span>
        {steps.map((s) => (
          <span
            key={s.label}
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
              !call
                ? 'border-slate-800 bg-[#151e30] text-slate-500'
                : s.ok
                  ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]'
                  : 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
