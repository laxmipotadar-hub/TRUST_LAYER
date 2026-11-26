import React from "react";
import { CheckCircle2, ShieldAlert, PauseCircle, UserCheck, PhoneOff } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { copy } from "../../copy";
import type { CallDecision, GuardState } from "../../types";

export interface OperatorActionsCardProps {
  decision?: CallDecision;
  guardState: GuardState;
  disabled: boolean;
  hasActiveSession?: boolean;
  isRecordingOrStreaming?: boolean;
  actionStatus?: "idle" | "running" | "done" | "error" | "timeout";
  actionReason?: string | null;
  onAction: (action: string, note: string) => void;
}

export const OperatorActionsCard: React.FC<OperatorActionsCardProps> = ({
  decision,
  guardState,
  disabled,
  hasActiveSession = true,
  isRecordingOrStreaming = false,
  actionStatus = "idle",
  actionReason = null,
  onAction,
}) => {
  const allowEnabled = !disabled && hasActiveSession && decision === "ALLOW";
  const allowDisableReason = disabled || !hasActiveSession
    ? "Start or analyze a call first."
    : decision !== "ALLOW"
    ? `Continue disabled: decision is ${decision || "PENDING"} (must be ALLOW / SAFE).`
    : null;

  const endCallEnabled = !disabled && (hasActiveSession || isRecordingOrStreaming);

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="card-title">{copy.operatorActions.title}</h3>
        <span className="caption-text font-mono text-[14px]">
          {actionStatus === "running"
            ? "RUNNING"
            : actionStatus === "timeout"
            ? "TIMED OUT"
            : actionStatus === "error"
            ? "ERROR"
            : guardState}
        </span>
      </div>
      {(actionStatus === "timeout" || actionStatus === "error") && actionReason && (
        <div
          role="alert"
          className="px-3 py-2 rounded-lg border border-[var(--decision-endcall-border)] bg-[var(--decision-endcall-tint)] text-[13px] font-medium text-[var(--decision-endcall-text)]"
        >
          {actionReason}
        </div>
      )}

      <div className="space-y-2">
        <div>
          <Button
            variant="primary"
            size="sm"
            className="w-full justify-start"
            disabled={!allowEnabled}
            onClick={() => onAction("ALLOW", "Operator continued verified call")}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Continue (Allow Call)
          </Button>
          {allowDisableReason && (
            <p className="caption-text text-[12px] mt-1 pl-1">{allowDisableReason}</p>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          disabled={disabled || !hasActiveSession}
          onClick={() => onAction("CHALLENGE", "Operator initiated dynamic liveness challenge")}
          icon={<ShieldAlert className="w-4 h-4" />}
        >
          Step-Up Challenge
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start border border-[var(--border)]"
          disabled={disabled || !hasActiveSession}
          onClick={() => onAction("PAUSE_BOT", "Operator paused Bot Guard")}
          icon={<PauseCircle className="w-4 h-4" />}
        >
          {copy.operatorActions.pauseBot}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start border border-[var(--border)]"
          disabled={disabled || !hasActiveSession}
          onClick={() => onAction("TRANSFER_TO_HUMAN", "Operator escalated to human specialist")}
          icon={<UserCheck className="w-4 h-4" />}
        >
          {copy.operatorActions.transferHuman}
        </Button>

        <div>
          <Button
            variant="danger"
            size="sm"
            className="w-full justify-start"
            disabled={!endCallEnabled}
            onClick={() => onAction("TERMINATE_CALL", "Operator terminated active call")}
            icon={<PhoneOff className="w-4 h-4" />}
          >
            {copy.operatorActions.endCall}
          </Button>
          {!endCallEnabled && (
            <p className="caption-text text-[12px] mt-1 pl-1">
              Disabled: no active call or recording stream to terminate.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
