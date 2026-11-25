import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/90 bg-[#111827] px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-[#151e30] text-sky-400">
        {icon ?? <Shield className="h-5 w-5" />}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[#f8fafc]">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-[#94a3b8]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
