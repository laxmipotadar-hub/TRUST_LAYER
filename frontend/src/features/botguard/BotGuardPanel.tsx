import React from "react";
import { Volume2, VolumeX, Play, UserCheck, RotateCcw } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { copy } from "../../copy";
import type { GuardState } from "../../types";

export interface BotGuardPanelProps {
  guardState: GuardState;
  guardEnabled: boolean;
  threshold: number;
  guardReason: string;
  speechSupported: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onChangeThreshold: (val: number) => void;
  onStartBot: () => void;
  onTransferHuman: () => void;
  onResumeOperator: () => void;
}

export const BotGuardPanel: React.FC<BotGuardPanelProps> = ({
  guardState,
  guardEnabled,
  threshold,
  guardReason,
  speechSupported,
  onToggleEnabled,
  onChangeThreshold,
  onStartBot,
  onTransferHuman,
  onResumeOperator,
}) => {
  const badgeVariant =
    guardState === "PAUSED_BY_GUARD"
      ? "danger"
      : guardState === "SPEAKING"
      ? "info"
      : guardState === "TRANSFERRED_TO_HUMAN"
      ? "warning"
      : "neutral";

  const isPaused = guardState === "PAUSED_BY_GUARD";
  const canStart =
    speechSupported &&
    guardState !== "PAUSED_BY_GUARD" &&
    guardState !== "TRANSFERRED_TO_HUMAN";

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isPaused ? (
            <VolumeX className="w-4 h-4 text-[var(--decision-endcall-solid)] shrink-0" />
          ) : (
            <Volume2 className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
          )}
          <h3 className="card-title truncate">{copy.botGuard.title}</h3>
        </div>
        <Badge variant={badgeVariant} size="sm">
          {guardState}
        </Badge>
      </div>

      {!speechSupported && (
        <p className="text-[14px] text-[var(--decision-stepup-text)] bg-[var(--decision-stepup-tint)] px-2.5 py-1.5 rounded border border-[var(--decision-stepup-border)]">
          {copy.botGuard.speechUnsupported}
        </p>
      )}

      {/* Reason display */}
      <div className="p-2.5 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] text-[14px]">
        <span className="text-[var(--text-muted)] block">{copy.botGuard.reasonLabel}</span>
        <span className="font-medium text-[var(--text-primary)]">{guardReason}</span>
      </div>

      {/* Guard Enabled Toggle */}
      <label className="flex items-center justify-between text-[14px] cursor-pointer">
        <span className="font-medium text-[var(--text-primary)]">{copy.botGuard.guardEnabled}</span>
        <input
          type="checkbox"
          checked={guardEnabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
          className="w-4 h-4 accent-[var(--brand-navy)] cursor-pointer"
        />
      </label>

      {/* Threshold Slider (default 40) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[14px]">
          <label htmlFor="botguard-threshold" className="text-[var(--text-secondary)]">
            {copy.botGuard.thresholdLabel}
          </label>
          <span className="font-bold font-mono text-[var(--text-primary)]">{threshold}</span>
        </div>
        <input
          id="botguard-threshold"
          type="range"
          min={0}
          max={100}
          step={5}
          value={threshold}
          onChange={(e) => onChangeThreshold(Number(e.target.value))}
          className="w-full accent-[var(--brand-steel)] cursor-pointer"
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          disabled={!canStart}
          onClick={onStartBot}
          icon={<Play className="w-4 h-4" />}
          className="w-full justify-start"
        >
          {copy.botGuard.startBot}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={guardState === "TRANSFERRED_TO_HUMAN"}
          onClick={onTransferHuman}
          icon={<UserCheck className="w-4 h-4" />}
          className="w-full justify-start"
        >
          {copy.botGuard.transferHuman}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={!isPaused}
          onClick={onResumeOperator}
          icon={<RotateCcw className="w-4 h-4" />}
          className="w-full justify-start border border-[var(--border)]"
        >
          {copy.botGuard.resumeOperator}
        </Button>
      </div>
    </Card>
  );
};
