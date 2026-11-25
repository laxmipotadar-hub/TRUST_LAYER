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
  onAction: (action: string, note: string) => void;
}

export const OperatorActionsCard: React.FC<OperatorActionsCardProps> = ({
  decision,
  guardState,
  disabled,
  onAction,
}) => {
  const allowEnabled = !disabled && decision === "ALLOW";

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="card-title">{copy.operatorActions.title}</h3>
        <span className="caption-text font-mono text-[14px]">{guardState}</span>
      </div>

      <div className="space-y-2">
        <Button
          variant="primary"
          size="sm"
          className="w-full justify-start"
          disabled={!allowEnabled}
          onClick={() => onAction("ALLOW", "Operator allowed verified call")}
          icon={<CheckCircle2 className="w-4 h-4" />}
        >
          {copy.operatorActions.allow}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          disabled={disabled}
          onClick={() => onAction("CHALLENGE", "Operator initiated dynamic liveness challenge")}
          icon={<ShieldAlert className="w-4 h-4" />}
        >
          {copy.operatorActions.runChallenge}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start border border-[var(--border)]"
          disabled={disabled}
          onClick={() => onAction("PAUSE_BOT", "Operator paused Bot Guard")}
          icon={<PauseCircle className="w-4 h-4" />}
        >
          {copy.operatorActions.pauseBot}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start border border-[var(--border)]"
          disabled={disabled}
          onClick={() => onAction("TRANSFER_TO_HUMAN", "Operator escalated to human specialist")}
          icon={<UserCheck className="w-4 h-4" />}
        >
          {copy.operatorActions.transferHuman}
        </Button>

        <Button
          variant="danger"
          size="sm"
          className="w-full justify-start"
          disabled={disabled}
          onClick={() => onAction("TERMINATE_CALL", "Operator terminated call")}
          icon={<PhoneOff className="w-4 h-4" />}
        >
          {copy.operatorActions.endCall}
        </Button>
      </div>
    </Card>
  );
};
