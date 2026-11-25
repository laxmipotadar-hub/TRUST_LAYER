import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "decision-continue" | "decision-stepup" | "decision-endcall";
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = "default",
  className = "",
  children,
  ...props
}) => {
  const variantStyles = {
    default:
      "bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-6",
    subtle:
      "bg-[var(--fill-subtle)] border border-[var(--border)] rounded-[12px] shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-6",
    "decision-continue":
      "bg-[var(--decision-continue-tint)] border border-[var(--decision-continue-border)] border-l-[6px] border-l-[var(--decision-continue-solid)] rounded-[12px] shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-6",
    "decision-stepup":
      "bg-[var(--decision-stepup-tint)] border border-[var(--decision-stepup-border)] border-l-[6px] border-l-[var(--decision-stepup-solid)] rounded-[12px] shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-6",
    "decision-endcall":
      "bg-[var(--decision-endcall-tint)] border border-[var(--decision-endcall-border)] border-l-[6px] border-l-[var(--decision-endcall-solid)] rounded-[12px] shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-6",
  }[variant];

  return (
    <div className={`${variantStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};
