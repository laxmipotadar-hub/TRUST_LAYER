import type {
  AnalysisProvenance,
  EvidenceSeverity,
  RiskLevel,
  SignalStatus,
  TrustVerdict,
} from '../types/aegis';

export function getVerdictStyle(verdict: TrustVerdict): {
  bg: string;
  border: string;
  text: string;
  accentHex: string;
} {
  switch (verdict) {
    case 'SAFE':
      return {
        bg: 'bg-[#22c55e]/12',
        border: 'border-[#22c55e]/40',
        text: 'text-[#22c55e]',
        accentHex: '#22c55e',
      };
    case 'CAUTION':
    case 'INCOMPLETE ANALYSIS':
      return {
        bg: 'bg-[#f59e0b]/12',
        border: 'border-[#f59e0b]/40',
        text: 'text-[#f59e0b]',
        accentHex: '#f59e0b',
      };
    case 'THREAT':
      return {
        bg: 'bg-[#ef4444]/12',
        border: 'border-[#ef4444]/40',
        text: 'text-[#ef4444]',
        accentHex: '#ef4444',
      };
  }
}

export function getSignalBadgeStyle(status: SignalStatus): string {
  switch (status) {
    case 'PASS':
      return 'bg-[#22c55e]/12 text-[#22c55e] border-[#22c55e]/30';
    case 'WARN':
      return 'bg-[#f59e0b]/12 text-[#f59e0b] border-[#f59e0b]/30';
    case 'FAIL':
      return 'bg-[#ef4444]/12 text-[#ef4444] border-[#ef4444]/30';
    case 'UNAVAILABLE':
    case 'INCOMPLETE':
      return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
  }
}

export function getProvenanceStyle(provenance: AnalysisProvenance): string {
  switch (provenance) {
    case 'REAL ANALYSIS':
      return 'bg-[#22c55e]/12 text-[#22c55e] border-[#22c55e]/35';
    case 'CACHED ANALYSIS':
      return 'bg-sky-500/12 text-sky-300 border-sky-500/35';
    case 'SIMULATION':
      return 'bg-[#f59e0b]/12 text-[#f59e0b] border-[#f59e0b]/35';
  }
}

export function getRiskBadgeStyle(risk: RiskLevel | EvidenceSeverity): string {
  switch (risk) {
    case 'LOW':
    case 'INFO':
      return 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/25';
    case 'MEDIUM':
    case 'WARNING':
      return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/25';
    case 'HIGH':
    case 'CRITICAL':
      return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/25';
  }
}
