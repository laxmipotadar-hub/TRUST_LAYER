import { Clock } from 'lucide-react';
import type { EvidenceEvent } from '../../types/aegis';
import { getRiskBadgeStyle } from '../../utils/statusStyles';
import { ProvenanceBadge } from '../common/ProvenanceBadge';

export function EvidenceTimeline({ events }: { events: EvidenceEvent[] }) {
  return (
    <div className="space-y-2.5">
      {events.map((ev) => (
        <div
          key={ev.id}
          className="animate-alert-in flex flex-col gap-1 rounded-lg border border-slate-800 bg-[#151e30]/75 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-sky-400" />
              <span className="font-mono text-[11px] text-sky-400">
                +{ev.timestamp_sec.toFixed(1)}s
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-[#f8fafc]">
                {ev.category}
              </span>
              <span className="text-xs font-semibold text-[#f8fafc]">{ev.title}</span>
            </div>

            <div className="flex items-center gap-2">
              <ProvenanceBadge provenance={ev.provenance} compact />
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${getRiskBadgeStyle(
                  ev.severity,
                )}`}
              >
                {ev.severity}
              </span>
            </div>
          </div>
          <p className="text-xs text-[#94a3b8]">{ev.description}</p>
        </div>
      ))}
    </div>
  );
}
