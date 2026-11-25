import type { AnalysisProvenance } from '../../types/aegis';
import { getProvenanceStyle } from '../../utils/statusStyles';

interface ProvenanceBadgeProps {
  provenance: AnalysisProvenance;
  compact?: boolean;
}

export function ProvenanceBadge({ provenance, compact = false }: ProvenanceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-mono uppercase tracking-wider ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${getProvenanceStyle(provenance)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {provenance}
    </span>
  );
}
