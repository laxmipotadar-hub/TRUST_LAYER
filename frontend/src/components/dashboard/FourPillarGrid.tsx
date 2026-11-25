import { AudioWaveform, Fingerprint, Gauge, MessageSquareWarning } from 'lucide-react';
import type { CallSession } from '../../types/aegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { MetricCard } from '../ui/MetricCard';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

function signalTone(status: string): StatusTone {
  if (status === 'PASS') return 'safe';
  if (status === 'FAIL') return 'threat';
  return 'caution';
}

export function FourPillarGrid({ call }: { call: CallSession }) {
  const { voice_authenticity: voice, speaker_identity: identity, scam_analysis: scam, liveness } =
    call;

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Voice Authenticity"
        value={voice.score !== null ? voice.score.toFixed(1) : 'N/A'}
        unit={voice.score !== null ? '%' : undefined}
        subtitle={voice.detail}
        tone={signalTone(voice.status)}
        icon={<AudioWaveform className="h-3.5 w-3.5 text-sky-400" />}
        badge={<StatusBadge label={voice.status} tone={signalTone(voice.status)} />}
        footer={
          <>
            <span className="font-mono">{voice.model_name}</span>
            <ProvenanceBadge provenance={voice.provenance} compact />
          </>
        }
      />

      <MetricCard
        title="Speaker Identity"
        value={identity.score !== null ? identity.score.toFixed(1) : 'N/A'}
        unit={identity.score !== null ? '%' : undefined}
        subtitle={identity.detail}
        tone={signalTone(identity.status)}
        icon={<Fingerprint className="h-3.5 w-3.5 text-sky-400" />}
        badge={<StatusBadge label={identity.status} tone={signalTone(identity.status)} />}
        footer={
          <>
            <span className="font-mono">{identity.model_name}</span>
            <ProvenanceBadge provenance={identity.provenance} compact />
          </>
        }
      />

      <MetricCard
        title="Scam-Script Risk"
        value={scam.risk_score.toFixed(0)}
        unit="/ 100"
        subtitle={scam.summary}
        tone={scam.risk_score >= 60 ? 'threat' : scam.risk_score >= 25 ? 'caution' : 'safe'}
        icon={<MessageSquareWarning className="h-3.5 w-3.5 text-sky-400" />}
        badge={
          <StatusBadge
            label={scam.risk_score >= 60 ? 'THREAT' : scam.risk_score >= 25 ? 'CAUTION' : 'SAFE'}
            tone={scam.risk_score >= 60 ? 'threat' : scam.risk_score >= 25 ? 'caution' : 'safe'}
          />
        }
        footer={
          <>
            <span className="truncate font-mono">{scam.engine_used}</span>
            <ProvenanceBadge provenance={scam.provenance} compact />
          </>
        }
      />

      <MetricCard
        title="Pressure & Liveness"
        value={scam.behavioral_pressure_score.toFixed(0)}
        unit="/ 100"
        subtitle={liveness.signal_notes}
        tone={!liveness.passed || scam.behavioral_pressure_score >= 60 ? 'threat' : 'safe'}
        icon={<Gauge className="h-3.5 w-3.5 text-sky-400" />}
        badge={
          <StatusBadge
            label={liveness.replay_detected ? 'REPLAY' : liveness.passed ? 'LIVE' : 'FAILED'}
            tone={!liveness.passed ? 'threat' : 'safe'}
          />
        }
        footer={
          <>
            <span className="font-mono">Challenge Liveness</span>
            <ProvenanceBadge provenance={liveness.provenance} compact />
          </>
        }
      />
    </section>
  );
}
