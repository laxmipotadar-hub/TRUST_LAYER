import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { AppProvider } from './context/AppContext';
import { useAegis } from './hooks/useAegis';
import { DashboardPage } from './pages/DashboardPage';
import { DeploymentPage } from './pages/DeploymentPage';
import { ReportsPage } from './pages/ReportsPage';
import { StageModePage } from './pages/StageModePage';
import { VoiceprintsPage } from './pages/VoiceprintsPage';

function StageShortcutListener() {
  const location = useLocation();
  const navigate = useNavigate();
  const { challengeModalOpen } = useAegis();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        navigate(location.pathname === '/stage' ? '/' : '/stage');
      } else if (e.key === 'Escape' && location.pathname === '/stage' && !challengeModalOpen) {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        navigate('/');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [location.pathname, navigate, challengeModalOpen]);

  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <StageShortcutListener />
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/voiceprints" element={<VoiceprintsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/deploy" element={<DeploymentPage />} />
              <Route path="/stage" element={<StageModePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
