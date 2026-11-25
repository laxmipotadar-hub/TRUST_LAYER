import type { ReactNode } from 'react';
import type { StatusTone } from './StatusBadge';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  tone?: StatusTone;
  icon?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

const ACCENT_BORDER: Record<StatusTone, string> = {
  safe: 'border-slate-800/90 hover:border-[#22c55e]/40',
  caution: 'border-slate-800/90 hover:border-[#f59e0b]/40',
  threat: 'border-[#ef4444]/40',
  info: 'border-slate-800/90 hover:border-sky-500/40',
  neutral: 'border-slate-800/90',
};

export function MetricCard({
  title,
  value,
  unit,
  subtitle,
  tone = 'neutral',
  icon,
  badge,
  footer,
  onClick,
  active = false,
  className = '',
}: MetricCardProps) {
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      {...(interactive ? { type: 'button' as const, onClick } : {})}
      className={`flex flex-col justify-between rounded-xl border bg-[#111827] p-4 text-left transition-all ${
        ACCENT_BORDER[tone]
      } ${active ? 'ring-1 ring-sky-500/50 border-sky-500/60 bg-[#151e30]' : ''} ${
        interactive ? 'cursor-pointer hover:bg-[#151e30]/75' : ''
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            {icon}
            <span>{title}</span>
          </div>
          {badge}
        </div>

        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-[#f8fafc]">
            {value}
          </span>
          {unit && <span className="font-mono text-xs text-[#94a3b8]">{unit}</span>}
        </div>

        {subtitle && <p className="mt-1.5 text-xs leading-relaxed text-[#94a3b8]">{subtitle}</p>}
      </div>

      {footer && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-[#94a3b8]">
          {footer}
        </div>
      )}
    </Tag>
  );
}
