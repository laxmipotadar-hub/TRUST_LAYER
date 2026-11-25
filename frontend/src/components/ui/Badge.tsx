import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "neutral" | "info" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  className = "",
}) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[14px]" : "px-2.5 py-1 text-[14px]";

  const variantClasses = {
    neutral: "bg-[var(--fill-subtle)] text-[var(--text-secondary)] border border-[var(--border)]",
    info: "bg-[var(--fill-subtle)] text-[var(--brand-steel)] border border-[var(--brand-steel)]",
    success: "bg-[var(--decision-continue-tint)] text-[var(--decision-continue-text)] border border-[var(--decision-continue-border)]",
    warning: "bg-[var(--decision-stepup-tint)] text-[var(--decision-stepup-text)] border border-[var(--decision-stepup-border)]",
    danger: "bg-[var(--decision-endcall-tint)] text-[var(--decision-endcall-text)] border border-[var(--decision-endcall-border)]",
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </span>
  );
};
