import type { ReactNode } from 'react';
import { AlertOctagon, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import type { StatusTone } from './StatusBadge';

interface AlertCardProps {
  title: string;
  description: string;
  tone?: StatusTone;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const STYLES: Record<StatusTone, { wrap: string; icon: ReactNode }> = {
  safe: {
    wrap: 'border-[#22c55e]/35 bg-[#22c55e]/10 text-[#22c55e]',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  caution: {
    wrap: 'border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#f59e0b]',
    icon: <ShieldAlert className="h-4 w-4 shrink-0" />,
  },
  threat: {
    wrap: 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444] animate-threat-escalation',
    icon: <AlertOctagon className="h-4 w-4 shrink-0" />,
  },
  info: {
    wrap: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
    icon: <Info className="h-4 w-4 shrink-0" />,
  },
  neutral: {
    wrap: 'border-slate-700 bg-[#151e30] text-[#f8fafc]',
    icon: <Info className="h-4 w-4 shrink-0 text-[#94a3b8]" />,
  },
};

export function AlertCard({
  title,
  description,
  tone = 'info',
  action,
  onDismiss,
  className = '',
}: AlertCardProps) {
  const style = STYLES[tone];
  return (
    <div
      role="alert"
      className={`animate-alert-in flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 ${style.wrap} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{style.icon}</div>
        <div>
          <div className="text-xs font-semibold">{title}</div>
          <p className="mt-0.5 text-xs opacity-90">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="rounded p-1 opacity-75 hover:bg-black/20 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
