import { Bot, Pause, PhoneForwarded, Play, RotateCcw, Volume2 } from 'lucide-react';
import { useAegis } from '../../hooks/useAegis';
import type { BotStatus, CallSession } from '../../types/aegis';
import { ActionButton } from '../ui/ActionButton';
import { AlertCard } from '../ui/AlertCard';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

function botStatusTone(status: BotStatus): StatusTone {
  switch (status) {
    case 'SPEAKING':
      return 'safe';
    case 'PAUSED BY GUARD':
      return 'threat';
    case 'TRANSFERRED TO HUMAN':
      return 'info';
    case 'IDLE':
      return 'neutral';
  }
}

export function BotGuardPanel({ call }: { call: CallSession }) {
  const {
    settings,
    botStatus,
    botGuardReason,
    botPausedLocked,
    updateBotGuard,
    playBotGreeting,
    pauseBotByOperator,
    resumeBotByOperator,
    executeCallAction,
    demoBotThreatInterrupt,
  } = useAegis();

  const botEnabled = settings?.bot_guard_enabled ?? true;
  const threshold = settings?.bot_guard_threshold ?? 40;

  return (
    <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          <Bot className="h-3.5 w-3.5 text-sky-400" />
          AEGIS Bot Guard
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={botEnabled}
          onClick={() => void updateBotGuard({ bot_guard_enabled: !botEnabled })}
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
            botEnabled
              ? 'border-[#22c55e]/40 bg-[#22c55e]/15 text-[#22c55e]'
              : 'border-slate-700 bg-slate-800 text-[#94a3b8]'
          }`}
        >
          GUARD: {botEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* BOT STATUS */}
      <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-800 bg-[#151e30] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
          BOT STATUS
        </span>
        <StatusBadge
          label={botStatus}
          tone={botStatusTone(botStatus)}
          dot
          pulse={botStatus === 'SPEAKING' || botStatus === 'PAUSED BY GUARD'}
        />
      </div>

      {/* Sample Bank Voice Box */}
      <div className="mb-3 rounded-lg border border-slate-800 bg-[#0a0f1e]/80 p-2.5">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
          <Volume2 className="h-3 w-3 text-sky-400" />
          Automated Bank Voice
        </div>
        <p className="mt-1 text-xs italic text-[#f8fafc]">
          &ldquo;Welcome to customer support. How may I help you today?&rdquo;
        </p>
      </div>

      {/* Prominent Red Alert when Paused by Guard */}
      {botStatus === 'PAUSED BY GUARD' && (
        <AlertCard
          className="mb-3"
          tone="threat"
          title="AEGIS BOT GUARD ACTIVATED"
          description={`Automated response suspended due to security risk. ${botGuardReason ?? ''}`}
          action={
            <ActionButton
              variant="primary"
              onClick={() =>
                void executeCallAction(
                  call.call_id,
                  'TRANSFER_TO_HUMAN',
                  'Human Takeover triggered from Bot Guard alert',
                )
              }
            >
              HUMAN TAKEOVER
            </ActionButton>
          }
        />
      )}

      {/* Transferred Confirmation */}
      {botStatus === 'TRANSFERRED TO HUMAN' && (
        <AlertCard
          className="mb-3"
          tone="info"
          title="TRANSFERRED TO HUMAN"
          description="Automated bot silenced. Call routed to human fraud specialist and logged in timeline & report."
        />
      )}

      {/* Threshold Slider */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[#94a3b8]">Threat Threshold</span>
          <span className="font-mono font-semibold text-[#f8fafc]">{threshold} / 100</span>
        </div>
        <input
          type="range"
          min={10}
          max={90}
          step={5}
          value={threshold}
          disabled={!botEnabled}
          onChange={(e) => void updateBotGuard({ bot_guard_threshold: Number(e.target.value) })}
          aria-label="Bot Guard threat threshold"
          className="w-full accent-sky-400"
        />
      </div>

      {/* Guard Controls */}
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          variant="safe"
          disabled={botPausedLocked || botStatus === 'SPEAKING'}
          icon={<Play className="h-3 w-3" />}
          onClick={playBotGreeting}
        >
          Play Bot
        </ActionButton>

        <ActionButton
          variant="caution"
          disabled={botStatus === 'PAUSED BY GUARD'}
          icon={<Pause className="h-3 w-3" />}
          onClick={pauseBotByOperator}
        >
          Pause Bot
        </ActionButton>

        <ActionButton
          variant="primary"
          icon={<PhoneForwarded className="h-3 w-3" />}
          onClick={() =>
            void executeCallAction(
              call.call_id,
              'TRANSFER_TO_HUMAN',
              'Operator selected Transfer to Human',
            )
          }
        >
          Transfer to Human
        </ActionButton>

        <ActionButton
          variant="secondary"
          disabled={!botPausedLocked}
          icon={<RotateCcw className="h-3 w-3" />}
          onClick={resumeBotByOperator}
        >
          Resume Bot
        </ActionButton>
      </div>

      {botPausedLocked && (
        <p className="mt-2 text-[11px] text-[#f59e0b]">
          Bot output locked. Explicit &ldquo;Resume Bot&rdquo; action required before speaking again.
        </p>
      )}

      {/* One-Click Audible Interruption Demo for S2/S3 */}
      <div className="mt-3 border-t border-slate-800 pt-2.5">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
          Live Audible Interruption Demo
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton variant="threat" onClick={() => void demoBotThreatInterrupt('S2')}>
            Demo S2 Interrupt
          </ActionButton>
          <ActionButton variant="threat" onClick={() => void demoBotThreatInterrupt('S3')}>
            Demo S3 Interrupt
          </ActionButton>
        </div>
      </div>
    </section>
  );
}
