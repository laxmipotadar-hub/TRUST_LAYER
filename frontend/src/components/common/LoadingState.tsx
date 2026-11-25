import { Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Connecting to AEGIS Trust Engine...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#111827] py-16 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
      <p className="mt-3 font-mono text-xs uppercase tracking-wider text-[#94a3b8]">{label}</p>
    </div>
  );
}
