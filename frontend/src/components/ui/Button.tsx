import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)] focus-visible:outline-none";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-[14px] gap-1.5 min-h-[32px]",
    md: "px-4 py-2 text-[16px] gap-2 min-h-[40px]",
    lg: "px-5 py-2.5 text-[16px] font-semibold gap-2.5 min-h-[44px]",
  };

  const variantStyles = {
    primary:
      "bg-[var(--brand-navy)] text-white hover:opacity-90 active:opacity-95 shadow-xs",
    secondary:
      "border border-[var(--brand-steel)] text-[var(--brand-steel)] bg-transparent hover:bg-[var(--fill-subtle)] active:opacity-90",
    ghost:
      "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--fill-subtle)] hover:text-[var(--text-primary)]",
    danger:
      "bg-[var(--decision-endcall-solid)] text-white hover:opacity-90 active:opacity-95 shadow-xs",
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : icon ? (
        <span className="inline-flex shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};
