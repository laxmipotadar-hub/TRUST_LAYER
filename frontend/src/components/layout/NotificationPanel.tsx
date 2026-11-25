import { Bell, CheckCheck, ShieldAlert, X } from 'lucide-react';
import type { CallSession } from '../../types/aegis';
import { StatusBadge } from '../ui/StatusBadge';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  calls: CallSession[];
  onSelectCall: (call: CallSession) => void;
  onMarkAllRead: () => void;
}

export function NotificationPanel({
  open,
  onClose,
  calls,
  onSelectCall,
  onMarkAllRead,
}: NotificationPanelProps) {
  if (!open) return null;

  const alerts = calls.slice(0, 6);

  return (
    <div
      className="animate-alert-in absolute right-4 top-14 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700/80 bg-[#111827] shadow-2xl"
      role="region"
      aria-label="SOC Notifications"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#f8fafc]">
            SOC Alert Feed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#94a3b8] hover:bg-[#151e30] hover:text-[#f8fafc]"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark read
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="rounded p-1 text-[#94a3b8] hover:bg-[#151e30] hover:text-[#f8fafc]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-80 divide-y divide-slate-800/80 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[#94a3b8]">
            No call alerts recorded yet. Run a demonstration scenario to inspect live alerts.
          </div>
        ) : (
          alerts.map((call) => {
            const verdict = call.trust_breakdown.final_decision || call.trust_breakdown.verdict;
            const tone =
              verdict === 'SAFE' ? 'safe' : verdict === 'THREAT' ? 'threat' : 'caution';
            return (
              <button
                key={call.call_id}
                type="button"
                onClick={() => {
                  onSelectCall(call);
                  onClose();
                }}
                className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[#151e30]"
              >
                <ShieldAlert
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    tone === 'threat'
                      ? 'text-[#ef4444]'
                      : tone === 'safe'
                        ? 'text-[#22c55e]'
                        : 'text-[#f59e0b]'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs font-semibold text-[#f8fafc]">
                      {call.call_id}
                    </span>
                    <StatusBadge label={verdict} tone={tone} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[#94a3b8]">{call.caller_label}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
