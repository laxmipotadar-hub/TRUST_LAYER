import { MessageSquareText } from 'lucide-react';
import type { CallSession } from '../../types/aegis';
import { getRiskBadgeStyle } from '../../utils/statusStyles';

interface LiveTranscriptPanelProps {
  call: CallSession;
  activeSegmentId: string | null;
}

export function LiveTranscriptPanel({ call, activeSegmentId }: LiveTranscriptPanelProps) {
  return (
    <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Live Call Transcript &amp; Risk Triggers
          </h2>
        </div>
        <span className="font-mono text-[11px] text-[#94a3b8]">
          {call.transcript.length} Turns
        </span>
      </div>

      <div className="space-y-2.5">
        {call.transcript.map((seg) => {
          const isSpeaking = activeSegmentId === seg.id;
          return (
            <div
              key={seg.id}
              className={`rounded-lg border p-3 transition-all ${
                isSpeaking
                  ? 'border-sky-400/70 bg-sky-500/10'
                  : 'border-slate-800 bg-[#151e30]/75'
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-300">
                    {seg.speaker}
                  </span>
                  <span className="font-mono text-[11px] text-[#94a3b8]">
                    {seg.timestamp_sec.toFixed(1)}s
                  </span>
                </div>
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${getRiskBadgeStyle(
                    seg.risk_level,
                  )}`}
                >
                  {seg.risk_level} RISK
                </span>
              </div>
              <p className="text-sm text-[#f8fafc]">{seg.text}</p>
              {seg.triggers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {seg.triggers.map((t, i) => (
                    <span
                      key={i}
                      className="rounded border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 py-0.5 font-mono text-[10px] text-[#ef4444]"
                    >
                      Trigger: {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
