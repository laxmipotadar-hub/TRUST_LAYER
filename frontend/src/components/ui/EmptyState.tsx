import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-xs ${className}`}
    >
      <div className="p-3 bg-[var(--fill-subtle)] text-[var(--brand-steel)] rounded-full mb-4">
        {icon || <FolderOpen className="w-8 h-8" />}
      </div>
      <h3 className="text-[18px] font-semibold text-[var(--text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-[14px] text-[var(--text-secondary)] max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
