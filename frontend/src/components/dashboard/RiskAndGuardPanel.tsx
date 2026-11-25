import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAegis } from '../../hooks/useAegis';
import type { CallActionType, CallSession } from '../../types/aegis';
import { ActionButton } from '../ui/ActionButton';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { BotGuardPanel } from './BotGuardPanel';

interface RiskAndGuardPanelProps {
  call: CallSession;
}

export function RiskAndGuardPanel({ call }: RiskAndGuardPanelProps) {
  const {
    activeChallenge,
    challengeResult,
    executeCallAction,
    openChallengeForCurrentCall,
  } = useAegis();

  const [actionBusy, setActionBusy] = useState<CallActionType | null>(null);

  const handleAction = async (action: CallActionType) => {
    setActionBusy(action);
    try {
      await executeCallAction(call.call_id, action, `Dashboard operator action: ${action}`);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* BOT GUARD CONTROL PANEL */}
      <BotGuardPanel call={call} />

      {/* RESPONSE ACTIONS */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          SOC Response Actions
        </h2>

        <div className="grid grid-cols-1 gap-2">
          <ActionButton
            variant="safe"
            loading={actionBusy === 'ALLOW'}
            onClick={() => void handleAction('ALLOW')}
          >
            ALLOW
          </ActionButton>
          <ActionButton
            variant="caution"
            loading={actionBusy === 'CHALLENGE'}
            onClick={() => void handleAction('CHALLENGE')}
          >
            CHALLENGE
          </ActionButton>
          <ActionButton
            variant="secondary"
            loading={actionBusy === 'PAUSE_BOT'}
            onClick={() => void handleAction('PAUSE_BOT')}
          >
            PAUSE BOT
          </ActionButton>
          <ActionButton
            variant="primary"
            loading={actionBusy === 'TRANSFER_TO_HUMAN'}
            onClick={() => void handleAction('TRANSFER_TO_HUMAN')}
          >
            TRANSFER TO HUMAN
          </ActionButton>
          <ActionButton
            variant="threat"
            loading={actionBusy === 'BLOCK_CALL'}
            onClick={() => void handleAction('BLOCK_CALL')}
          >
            BLOCK CALL
          </ActionButton>
        </div>

        {(activeChallenge || challengeResult) && (
          <div className="animate-alert-in mt-3 rounded-lg border border-[#f59e0b]/40 bg-[#0a0f1e] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#f59e0b]">
                Challenge Status
              </span>
              {challengeResult && (
                <StatusBadge
                  label={challengeResult.liveness_status}
                  tone={challengeResult.passed ? 'safe' : 'threat'}
                />
              )}
            </div>
            {activeChallenge && (
              <div className="mt-1 font-mono text-xs text-[#f8fafc]">
                Phrase: &ldquo;{activeChallenge.phrase}&rdquo;
              </div>
            )}
            <ActionButton
              className="mt-2 w-full"
              variant="caution"
              onClick={() => void openChallengeForCurrentCall()}
            >
              Launch / Re-run Live Challenge
            </ActionButton>
          </div>
        )}
      </section>

      {/* SECURITY ALERTS FEED */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <ShieldAlert className="h-3.5 w-3.5 text-sky-400" />
            Security Alerts
          </div>
          <span className="font-mono text-[10px] text-[#94a3b8]">
            {call.evidence_timeline.length} Events
          </span>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {call.evidence_timeline.map((ev) => {
            const tone: StatusTone =
              ev.severity === 'CRITICAL'
                ? 'threat'
                : ev.severity === 'WARNING'
                  ? 'caution'
                  : 'safe';
            return (
              <div
                key={ev.id}
                className="animate-alert-in rounded-lg border border-slate-800 bg-[#151e30]/80 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-sky-400">
                    +{ev.timestamp_sec.toFixed(1)}s · {ev.category}
                  </span>
                  <StatusBadge label={ev.severity} tone={tone} />
                </div>
                <div className="mt-1 text-xs font-semibold text-[#f8fafc]">{ev.title}</div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#94a3b8]">
                  {ev.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
