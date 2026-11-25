import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'safe' | 'caution' | 'threat' | 'ghost';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border-sky-500/40 bg-sky-600/90 text-white hover:bg-sky-500 disabled:bg-sky-800/40',
  secondary:
    'border-slate-700 bg-[#151e30] text-[#f8fafc] hover:border-slate-600 hover:bg-slate-800',
  safe:
    'border-[#22c55e]/40 bg-[#22c55e]/12 text-[#22c55e] hover:bg-[#22c55e]/20',
  caution:
    'border-[#f59e0b]/40 bg-[#f59e0b]/12 text-[#f59e0b] hover:bg-[#f59e0b]/20',
  threat:
    'border-[#ef4444]/40 bg-[#ef4444]/12 text-[#ef4444] hover:bg-[#ef4444]/20',
  ghost:
    'border-transparent bg-transparent text-[#94a3b8] hover:bg-[#151e30] hover:text-[#f8fafc]',
};

export function ActionButton({
  variant = 'secondary',
  size = 'sm',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ActionButtonProps) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs';
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${sizeClass} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
