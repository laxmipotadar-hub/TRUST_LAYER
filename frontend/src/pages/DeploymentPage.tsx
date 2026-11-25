import { useCallback, useEffect, useState } from 'react';
import { Database, Network, Server } from 'lucide-react';
import { ArchitectureDiagram } from '../components/deploy/ArchitectureDiagram';
import { ThreatRegistryPanel } from '../components/deploy/ThreatRegistryPanel';
import { AlertCard } from '../components/ui/AlertCard';
import { Card } from '../components/ui/Card';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { aegisApi } from '../services/api';
import type { SettingsResponse, ThreatRegistryResponse } from '../types/aegis';

export function DeploymentPage() {
  const [settingsData, setSettingsData] = useState<SettingsResponse | null>(null);
  const [registry, setRegistry] = useState<ThreatRegistryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'architecture' | 'registry'>('architecture');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [s, r] = await Promise.all([aegisApi.getSettings(), aegisApi.getThreatRegistry()]);
      setSettingsData(s);
      setRegistry(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deployment & threat registry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Header & Module Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#f8fafc]">
            Banking Deployment &amp; Community Threat Intelligence
          </h2>
          <p className="text-xs text-[#94a3b8]">
            Proposed enterprise telephony topology and anonymized SOC threat-sharing registry.
          </p>
        </div>

        <div className="flex items-center rounded-lg border border-slate-800 bg-[#111827] p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'architecture'
                ? 'bg-[#151e30] text-sky-300'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            Banking Deployment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('registry')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'registry'
                ? 'bg-[#151e30] text-sky-300'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            Threat Intelligence ({registry?.total ?? 0})
          </button>
        </div>
      </div>

      {error && (
        <AlertCard
          tone="threat"
          title="Deployment Module Error"
          description={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Runtime Readiness Strip */}
      {settingsData && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] py-3">
          <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
            <Database className="h-4 w-4 text-sky-400" />
            <span className="font-semibold text-[#f8fafc]">Runtime Node Status:</span>
            <span className="font-mono">Mode={settingsData.app_mode}</span>
            <span>·</span>
            <span className="font-mono">Cache={String(settingsData.cache_enabled)}</span>
            <span>·</span>
            <span className="font-mono">
              BotGuard={settingsData.bot_guard_enabled ? `ON (${settingsData.bot_guard_threshold})` : 'OFF'}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className={settingsData.detectifai_configured ? 'text-[#22c55e]' : 'text-[#f59e0b]'}>
              DetectifAI: {settingsData.detectifai_configured ? 'CONFIGURED' : 'NOT SET'}
            </span>
            <span className={settingsData.gemini_configured ? 'text-[#22c55e]' : 'text-[#f59e0b]'}>
              Gemini: {settingsData.gemini_configured ? 'CONFIGURED' : 'NOT SET'}
            </span>
          </div>
        </Card>
      )}

      {activeTab === 'architecture' ? (
        <ArchitectureDiagram />
      ) : (
        registry && <ThreatRegistryPanel registry={registry} onRefresh={loadData} />
      )}
    </div>
  );
}
