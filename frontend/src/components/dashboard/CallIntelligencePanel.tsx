import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Clock,
  CreditCard,
  Fingerprint,
  MessageSquareText,
  Phone,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import type { CallSession, FlaggedPhrase } from '../../types/aegis';
import { SpeakerMatchRing } from '../charts/SpeakerMatchRing';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

interface CallIntelligencePanelProps {
  call: CallSession;
  activeSegmentId: string | null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function CallIntelligencePanel({ call, activeSegmentId }: CallIntelligencePanelProps) {
  const [selectedPhrase, setSelectedPhrase] = useState<FlaggedPhrase | null>(null);

  useEffect(() => {
    setSelectedPhrase(null);
  }, [call.call_id]);

  const profile = call.caller_profile ?? {
    caller_phone_id: 'SIP / Inbound',
    claimed_name: call.caller_label,
    account_ref_masked: `•••• ${call.claimed_customer_id.slice(-4)}`,
    call_duration_sec: 15.0,
    verification_status: call.speaker_identity.status,
  };

  const flaggedPhrases = call.scam_analysis.flagged_phrases;

  // Build lookup map of lowercase phrase -> FlaggedPhrase
  const phraseMap = useMemo(() => {
    const map = new Map<string, FlaggedPhrase>();
    for (const fp of flaggedPhrases) {
      map.set(fp.phrase.toLowerCase(), fp);
    }
    return map;
  }, [flaggedPhrases]);

  const highlightRegex = useMemo(() => {
    const terms = flaggedPhrases
      .map((f) => f.phrase.trim())
      .filter((p) => p.length > 0)
      .sort((a, b) => b.length - a.length);
    if (terms.length === 0) return null;
    return new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  }, [flaggedPhrases]);

  const renderHighlightedText = (text: string): ReactNode => {
    if (!highlightRegex) return text;
    const parts = text.split(highlightRegex);
    return parts.map((part, idx) => {
      const matched = phraseMap.get(part.toLowerCase());
      if (!matched) return <span key={idx}>{part}</span>;
      const isHigh = matched.severity === 'HIGH';
      return (
        <button
          key={idx}
          type="button"
          onClick={() => setSelectedPhrase(matched)}
          title="Click to inspect why this phrase was flagged"
          className={`mx-0.5 inline rounded border px-1 py-0.5 text-left font-medium transition-colors ${
            isHigh
              ? 'border-[#ef4444]/50 bg-[#ef4444]/15 text-[#fca5a5] hover:bg-[#ef4444]/25'
              : 'border-[#f59e0b]/50 bg-[#f59e0b]/15 text-[#fcd34d] hover:bg-[#f59e0b]/25'
          }`}
        >
          {part}
        </button>
      );
    });
  };

  const idTone: StatusTone =
    call.speaker_identity.status === 'PASS'
      ? 'safe'
      : call.speaker_identity.status === 'FAIL'
        ? 'threat'
        : 'caution';

  return (
    <div className="flex flex-col gap-4">
      {/* CALLER PROFILE */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            Caller Profile
          </h2>
          <StatusBadge label={profile.verification_status} tone={idTone} />
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[#94a3b8]">
              <User className="h-3.5 w-3.5 text-sky-400" />
              Claimed Name
            </span>
            <span className="font-semibold text-[#f8fafc]">{profile.claimed_name}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[#94a3b8]">
              <Phone className="h-3.5 w-3.5 text-sky-400" />
              Caller ID
            </span>
            <span className="font-mono text-[#f8fafc]">{profile.caller_phone_id}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[#94a3b8]">
              <CreditCard className="h-3.5 w-3.5 text-sky-400" />
              Account Ref
            </span>
            <span className="font-mono text-[#f8fafc]">{profile.account_ref_masked}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[#94a3b8]">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              Call Duration
            </span>
            <span className="font-mono text-[#f8fafc]">{profile.call_duration_sec.toFixed(0)}s</span>
          </div>
        </div>
      </section>

      {/* VOICEPRINT MATCH */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <Fingerprint className="h-3.5 w-3.5 text-sky-400" />
            Voiceprint Match (Eidos)
          </div>
          <StatusBadge
            label={call.speaker_identity.enrolled === false ? 'UNENROLLED' : 'ENROLLED'}
            tone={call.speaker_identity.enrolled === false ? 'caution' : 'info'}
          />
        </div>

        <div className="flex items-center gap-4">
          <SpeakerMatchRing
            percentage={call.speaker_identity.score}
            enrolled={call.speaker_identity.enrolled !== false}
            size={80}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold tabular-nums text-[#f8fafc]">
                {call.speaker_identity.score !== null
                  ? `${call.speaker_identity.score.toFixed(1)}%`
                  : 'N/A'}
              </span>
              <StatusBadge label={call.speaker_identity.status} tone={idTone} />
            </div>
            <p className="text-[11px] leading-snug text-[#94a3b8]">
              {call.speaker_identity.detail}
            </p>
          </div>
        </div>
      </section>

      {/* LIVE TRANSCRIPT */}
      <section className="flex flex-1 flex-col rounded-xl border border-slate-800/90 bg-[#111827] p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <MessageSquareText className="h-3.5 w-3.5 text-sky-400" />
            Live Transcript
          </div>
          <span className="font-mono text-[10px] text-[#94a3b8]">
            {flaggedPhrases.length} Flagged Phrases
          </span>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {call.transcript.map((seg) => {
            const isSpeaking = activeSegmentId === seg.id;
            return (
              <div
                key={seg.id}
                className={`rounded-lg border p-2.5 transition-colors ${
                  isSpeaking
                    ? 'border-sky-400/70 bg-sky-500/10'
                    : 'border-slate-800 bg-[#151e30]/75'
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="font-mono font-semibold text-sky-300">{seg.speaker}</span>
                  <span className="font-mono text-[#94a3b8]">{seg.timestamp_sec.toFixed(1)}s</span>
                </div>
                <p className="text-xs leading-relaxed text-[#f8fafc]">
                  {renderHighlightedText(seg.text)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Clickable Suspicious Phrase Inspector */}
        {selectedPhrase ? (
          <div className="animate-alert-in mt-3 rounded-lg border border-[#ef4444]/40 bg-[#0a0f1e] p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-[#ef4444]">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">"{selectedPhrase.phrase}"</span>
              </div>
              <button
                type="button"
                aria-label="Close phrase detail"
                onClick={() => setSelectedPhrase(null)}
                className="rounded p-0.5 text-[#94a3b8] hover:text-[#f8fafc]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
              <span className="text-[#f59e0b]">{selectedPhrase.category}</span>
              <span className="text-[#ef4444]">+{selectedPhrase.weight} Risk Contribution</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#94a3b8]">
              {selectedPhrase.explanation}
            </p>
          </div>
        ) : flaggedPhrases.length > 0 ? (
          <p className="mt-2.5 text-[11px] text-[#94a3b8]">
            Click any highlighted phrase above to inspect its fraud category and risk weight.
          </p>
        ) : null}
      </section>
    </div>
  );
}
