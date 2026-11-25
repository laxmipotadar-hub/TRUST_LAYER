import React from "react";
import { copy } from "../../copy";

export type ModeBadgeType = "LIVE" | "REAL" | "CACHED" | "DEMO";

export interface ModeBadgeProps {
  mode: ModeBadgeType;
  className?: string;
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode, className = "" }) => {
  const styles: Record<ModeBadgeType, string> = {
    LIVE: "bg-[var(--brand-navy)] text-white border border-[var(--brand-navy)]",
    REAL: "bg-[var(--brand-navy)] text-white border border-[var(--brand-navy)]",
    CACHED: "bg-transparent text-[var(--brand-steel)] border border-[var(--brand-steel)]",
    DEMO: "bg-[var(--mode-demo-bg)] text-[var(--mode-demo-text)] border border-[var(--mode-demo-bg)]",
  };

  const label =
    mode === "LIVE"
      ? "LIVE"
      : mode === "REAL"
      ? copy.modes.real
      : mode === "CACHED"
      ? copy.modes.cached
      : copy.modes.demo;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[14px] font-semibold tracking-wide ${styles[mode]} ${className}`}
      title={
        mode === "LIVE" || mode === "REAL"
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
