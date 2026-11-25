import { History, ShieldAlert } from 'lucide-react';
import type { CallSession } from '../../types/aegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { EvidenceTimeline } from './EvidenceTimeline';

interface EvidenceAndCallsPanelProps {
  call: CallSession;
  callsHistory: CallSession[];
  onSelectCall: (call: CallSession) => void;
}

function verdictTone(verdict: string): StatusTone {
  if (verdict === 'SAFE') return 'safe';
  if (verdict === 'THREAT') return 'threat';
  return 'caution';
}

export function EvidenceAndCallsPanel({
  call,
  callsHistory,
  onSelectCall,
}: EvidenceAndCallsPanelProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="rounded-xl border border-slate-800/90 bg-[#111827] p-4 lg:col-span-7">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              Forensic Evidence Timeline
            </h2>
          </div>
          <span className="font-mono text-[11px] text-[#94a3b8]">
            {call.evidence_timeline.length} Events
          </span>
        </div>

        <EvidenceTimeline events={call.evidence_timeline} />

        {call.actions_taken.length > 0 && (
          <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
              Operator Actions Logged
            </div>
            <ul className="mt-1 space-y-1">
              {call.actions_taken.map((act, idx) => (
                <li key={idx} className="font-mono text-xs text-[#f8fafc]">
                  {act.action} — {act.operator_note || 'Executed by SOC operator'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800/90 bg-[#111827] p-4 lg:col-span-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              Call Audit Log
            </h2>
          </div>
          <span className="font-mono text-[11px] text-[#94a3b8]">
            {callsHistory.length} Stored
          </span>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {callsHistory.map((item) => {
            const isSelected = item.call_id === call.call_id;
            const verdict = item.trust_breakdown.final_decision || item.trust_breakdown.verdict;
            const scoreStr =
              item.trust_breakdown.composite_score !== null
                ? item.trust_breakdown.composite_score.toFixed(2)
                : 'N/A';

            return (
              <button
                key={item.call_id}
                type="button"
                onClick={() => onSelectCall(item)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-sky-500/60 bg-[#151e30]'
                    : 'border-slate-800 bg-[#151e30]/50 hover:border-slate-700 hover:bg-[#151e30]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#f8fafc]">
                    {item.call_id}
                  </span>
                  <StatusBadge label={`${verdict} (${scoreStr})`} tone={verdictTone(verdict)} />
                </div>
                <div className="mt-1 truncate text-xs text-[#f8fafc]">{item.caller_label}</div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#94a3b8]">
                  <span className="font-mono">{item.mode} MODE</span>
                  <ProvenanceBadge provenance={item.overall_provenance} compact />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
