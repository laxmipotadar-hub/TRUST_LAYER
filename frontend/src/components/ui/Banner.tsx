import React from "react";
import { Info, AlertTriangle, XCircle } from "lucide-react";

export interface BannerProps {
  variant?: "info" | "warn" | "error";
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({
  variant = "info",
  title,
  children,
  action,
  className = "",
}) => {
  const styles = {
    info: {
      box: "bg-[var(--fill-subtle)] border-[var(--border)] text-[var(--text-primary)]",
      icon: <Info className="w-5 h-5 text-[var(--brand-steel)] shrink-0 mt-0.5" />,
    },
    warn: {
      box: "bg-[var(--decision-stepup-tint)] border-[var(--decision-stepup-border)] text-[var(--decision-stepup-text)]",
      icon: <AlertTriangle className="w-5 h-5 text-[var(--decision-stepup-solid)] shrink-0 mt-0.5" />,
    },
    error: {
      box: "bg-[var(--decision-endcall-tint)] border-[var(--decision-endcall-border)] text-[var(--decision-endcall-text)]",
      icon: <XCircle className="w-5 h-5 text-[var(--decision-endcall-solid)] shrink-0 mt-0.5" />,
    },
  }[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-lg border text-[14px] leading-normal ${styles.box} ${className}`}
    >
      {styles.icon}
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-[16px] mb-1">{title}</p>}
        <div>{children}</div>
      </div>
      {action && <div className="shrink-0 ml-2">{action}</div>}
    </div>
  );
};
