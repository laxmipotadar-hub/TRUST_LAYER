import React from "react";
import { CheckCircle2, MinusCircle, Clock, Loader2, XCircle } from "lucide-react";
import { copy } from "../../copy";

export type StatusChipType = "done" | "skipped" | "pending" | "queued" | "running" | "error";

export interface StatusChipProps {
  status: StatusChipType;
  label?: string;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  className = "",
}) => {
  const config = {
    done: {
      icon: <CheckCircle2 className="w-4 h-4 text-[var(--decision-continue-solid)] shrink-0" />,
      text: label || copy.statusChip.done,
      style:
        "bg-[var(--decision-continue-tint)] text-[var(--decision-continue-text)] border border-[var(--decision-continue-border)]",
    },
    skipped: {
      icon: <MinusCircle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />,
      text: label || copy.statusChip.skipped,
      style:
        "bg-[var(--fill-subtle)] text-[var(--text-secondary)] border border-[var(--border)]",
    },
    pending: {
      icon: <Clock className="w-4 h-4 text-[var(--decision-stepup-solid)] shrink-0" />,
      text: label || copy.statusChip.pending,
      style:
        "bg-[var(--decision-stepup-tint)] text-[var(--decision-stepup-text)] border border-[var(--decision-stepup-border)]",
    },
    queued: {
      icon: <Clock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />,
      text: label || "queued",
      style:
        "bg-[var(--fill-subtle)] text-[var(--text-secondary)] border border-[var(--border)]",
    },
    running: {
      icon: <Loader2 className="w-4 h-4 text-[var(--brand-steel)] animate-spin shrink-0" />,
      text: label || copy.statusChip.running,
      style:
        "bg-[var(--fill-subtle)] text-[var(--brand-steel)] border border-[var(--brand-steel)]",
    },
    error: {
      icon: <XCircle className="w-4 h-4 text-[var(--decision-endcall-solid)] shrink-0" />,
      text: label || copy.statusChip.error,
      style:
        "bg-[var(--decision-endcall-tint)] text-[var(--decision-endcall-text)] border border-[var(--decision-endcall-border)]",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[14px] font-semibold ${config.style} ${className}`}
    >
      {config.icon}
      <span>{config.text}</span>
    </span>
  );
};
