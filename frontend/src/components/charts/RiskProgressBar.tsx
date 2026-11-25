interface RiskProgressBarProps {
  label: string;
  value: number;
  invertRisk?: boolean;
  sublabel?: string;
}

export function RiskProgressBar({
  label,
  value,
  invertRisk = false,
  sublabel,
}: RiskProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  // If invertRisk=false, higher = riskier (red >=60, amber >=25, green <25)
  // If invertRisk=true, higher = safer (green >=75, amber >=40, red <40)
  const color = invertRisk
    ? clamped >= 75
      ? '#22c55e'
      : clamped >= 40
        ? '#f59e0b'
        : '#ef4444'
    : clamped >= 60
      ? '#ef4444'
      : clamped >= 25
        ? '#f59e0b'
        : '#22c55e';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[#f8fafc]">{label}</span>
        <span className="font-mono font-semibold tabular-nums text-[#f8fafc]">
          {clamped.toFixed(1)}
          <span className="text-[#94a3b8]"> / 100</span>
        </span>
      </div>

      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800/90"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>

      {sublabel && <div className="text-[11px] text-[#94a3b8]">{sublabel}</div>}
    </div>
  );
}
