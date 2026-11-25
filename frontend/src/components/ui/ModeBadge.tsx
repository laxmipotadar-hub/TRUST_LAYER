import React from "react";
import type { ModeType } from "../../types";
import { copy } from "../../copy";

export interface ModeBadgeProps {
  mode: ModeType;
  className?: string;
}

/**
 * Mode badges use distinct hues so they never look like decisions:
 * - REAL = solid navy
 * - CACHED = steel-blue outline
 * - DEMO = violet
 */
export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode, className = "" }) => {
  const styles = {
    REAL: "bg-[var(--brand-navy)] text-white border border-[var(--brand-navy)]",
    CACHED:
      "bg-transparent text-[var(--brand-steel)] border border-[var(--brand-steel)]",
    DEMO: "bg-[var(--mode-demo-bg)] text-[var(--mode-demo-text)] border border-[var(--mode-demo-bg)]",
  }[mode];

  const label =
    mode === "REAL"
      ? copy.modes.real
      : mode === "CACHED"
      ? copy.modes.cached
      : copy.modes.demo;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[14px] font-semibold tracking-wide ${styles} ${className}`}
      title={
        mode === "REAL"
          ? copy.modes.realDescription
          : mode === "CACHED"
          ? copy.modes.cachedDescription
          : copy.modes.demoDescription
      }
    >
      {label}
    </span>
  );
};
