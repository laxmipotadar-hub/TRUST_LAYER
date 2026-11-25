import React from "react";

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "h-4 w-full" }) => {
  return (
    <div
      className={`animate-pulse bg-[var(--fill-subtle)] border border-[var(--border)] rounded-md ${className}`}
      aria-hidden="true"
    />
  );
};
