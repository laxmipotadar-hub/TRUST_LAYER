import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAegis } from '../../hooks/useAegis';
import { AlertCard } from '../ui/AlertCard';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

export function AppShell({ children }: { children: ReactNode }) {
  const { error, clearError } = useAegis();
  const location = useLocation();
  const isStageMode = location.pathname === '/stage';

  if (isStageMode) {
    return <div className="h-screen w-screen overflow-hidden bg-[#0a0f1e] text-[#f8fafc]">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#0a0f1e] text-[#f8fafc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />
        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-4 p-4 lg:p-5">
          {error && (
            <AlertCard
              tone="threat"
              title="Backend Communication Alert"
              description={error}
              onDismiss={clearError}
            />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
