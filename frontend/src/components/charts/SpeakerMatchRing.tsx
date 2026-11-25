interface SpeakerMatchRingProps {
  percentage: number | null;
  enrolled?: boolean;
  size?: number;
}

export function SpeakerMatchRing({
  percentage,
  enrolled = true,
  size = 76,
}: SpeakerMatchRingProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = percentage !== null ? Math.max(0, Math.min(100, percentage)) : 0;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    percentage === null
      ? '#475569'
      : !enrolled
        ? '#f59e0b'
        : clamped >= 75
          ? '#22c55e'
          : clamped >= 40
            ? '#f59e0b'
            : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 550ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-bold tabular-nums text-[#f8fafc]">
          {percentage !== null ? `${percentage.toFixed(0)}%` : 'N/A'}
        </span>
      </div>
    </div>
  );
}
