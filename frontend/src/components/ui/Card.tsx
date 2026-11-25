import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-xl border border-slate-800/90 bg-[#111827] p-4 ${className}`}>
      {children}
    </div>
  );
}
