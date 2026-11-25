import type { TrustVerdict } from '../../types/aegis';
import { getVerdictStyle } from '../../utils/statusStyles';

interface TrustScoreRadialGaugeProps {
  score: number | null;
  verdict: TrustVerdict;
  label?: string;
  size?: number;
}

export function TrustScoreRadialGauge({
  score,
  verdict,
  label = 'TRUST SCORE',
  size = 168,
}: TrustScoreRadialGaugeProps) {
  const style = getVerdictStyle(verdict);
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  // 270-degree arc sweep
  const arcLength = circumference * 0.75;
  const clamped = score !== null ? Math.max(0, Math.min(100, score)) : 0;
  const filledLength = (clamped / 100) * arcLength;
  const dashOffset = arcLength - filledLength;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Trust score ${score !== null ? score.toFixed(2) : 'unavailable'} out of 100, verdict ${verdict}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Animated Value Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={score !== null ? style.accentHex : '#475569'}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1), stroke 300ms ease',
            }}
          />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-[#f8fafc] transition-all duration-300">
          {score !== null ? score.toFixed(2) : 'N/A'}
        </span>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-[#94a3b8]">
          {label}
        </span>
      </div>
    </div>
  );
}
