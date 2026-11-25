import { Mic, Play, Radio, Square, Volume2 } from 'lucide-react';
import type { ScenarioDefinition } from '../../types/aegis';
import { getVerdictStyle } from '../../utils/statusStyles';

interface ScenarioControlStripProps {
  scenarios: ScenarioDefinition[];
  activeScenarioId: string | null;
  runningScenarioId: string | null;
  isSpeaking: boolean;
  audibleTelemetry: boolean;
  hasActiveCall: boolean;
  onRunScenario: (scenarioId: string) => void;
  onPlayCallAudio: () => void;
  onStopCallAudio: () => void;
  onToggleAudibleTelemetry: () => void;
  onOpenLiveCall: () => void;
}

export function ScenarioControlStrip({
  scenarios,
  activeScenarioId,
  runningScenarioId,
  isSpeaking,
  audibleTelemetry,
  hasActiveCall,
  onRunScenario,
  onPlayCallAudio,
  onStopCallAudio,
  onToggleAudibleTelemetry,
  onOpenLiveCall,
}: ScenarioControlStripProps) {
  return (
    <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
          Demonstration Scenarios (S1 – S4) &amp; Live Call Analysis
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenLiveCall}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#22c55e]/50 bg-[#22c55e]/15 px-3 py-1.5 font-mono text-xs font-semibold text-[#22c55e] transition-colors hover:bg-[#22c55e]/25"
          >
            <Mic className="h-3.5 w-3.5" />
            LIVE CALL
          </button>
          <button
            type="button"
            disabled={!hasActiveCall}
            onClick={onToggleAudibleTelemetry}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              audibleTelemetry
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                : 'border-slate-700 bg-[#151e30] text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            {audibleTelemetry ? 'Telemetry Tone: ON' : 'Telemetry Tone: MUTED'}
          </button>

          {!isSpeaking ? (
            <button
              type="button"
              disabled={!hasActiveCall}
              onClick={onPlayCallAudio}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/25 disabled:opacity-40"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Speak Call Dialogue
            </button>
          ) : (
            <button
              type="button"
              onClick={onStopCallAudio}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#ef4444]/40 bg-[#ef4444]/15 px-3 py-1.5 text-xs font-medium text-[#ef4444] hover:bg-[#ef4444]/25"
            >
              <Square className="h-3.5 w-3.5" />
              Stop Audio
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((sc) => {
          const isActive = activeScenarioId === sc.id;
          const isLoading = runningScenarioId === sc.id;
          const vStyle = getVerdictStyle(sc.expected_verdict);

          return (
            <button
              key={sc.id}
              type="button"
              disabled={runningScenarioId !== null}
              onClick={() => onRunScenario(sc.id)}
              className={`group flex flex-col justify-between rounded-lg border p-3.5 text-left transition-all ${
                isActive
                  ? 'border-sky-500/60 bg-[#151e30] ring-1 ring-sky-500/30'
                  : 'border-slate-800 bg-[#151e30]/60 hover:border-slate-700 hover:bg-[#151e30]'
              }`}
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-sky-300">
                    {sc.code}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] font-medium ${vStyle.bg} ${vStyle.border} ${vStyle.text}`}
                  >
                    {sc.expected_verdict}
                  </span>
                </div>
                <div className="text-sm font-semibold text-[#f8fafc] group-hover:text-sky-200">
                  {sc.title}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#94a3b8]">{sc.subtitle}</p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-[#94a3b8]">
                <span className="font-mono">{sc.claimed_customer_id}</span>
                <span className="inline-flex items-center gap-1 font-medium text-sky-400">
                  <Play className="h-3 w-3" />
                  {isLoading ? 'Running...' : isActive ? 'Re-run' : 'Run'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
