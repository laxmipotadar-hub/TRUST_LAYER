import type { ReactNode } from 'react';

export type StatusTone = 'safe' | 'caution' | 'threat' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  className?: string;
}

const TONE_MAP: Record<StatusTone, string> = {
  safe: 'bg-[#22c55e]/12 text-[#22c55e] border-[#22c55e]/35',
  caution: 'bg-[#f59e0b]/12 text-[#f59e0b] border-[#f59e0b]/35',
  threat: 'bg-[#ef4444]/12 text-[#ef4444] border-[#ef4444]/35',
  info: 'bg-sky-500/12 text-sky-300 border-sky-500/35',
  neutral: 'bg-slate-800/70 text-[#94a3b8] border-slate-700',
};

export function StatusBadge({
  label,
  tone = 'neutral',
  dot = false,
  pulse = false,
  size = 'sm',
  icon,
  className = '',
}: StatusBadgeProps) {
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-mono font-semibold uppercase tracking-wider transition-colors ${sizing} ${TONE_MAP[tone]} ${className}`}
    >
      {dot && (
        <span className="relative flex h-2 w-2 items-center justify-center">
          {pulse && (
            <span className="animate-live-ring absolute inline-flex h-full w-full rounded-full bg-current" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {icon}
      {label}
    </span>
  );
}
