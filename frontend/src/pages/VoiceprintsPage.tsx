import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Fingerprint,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { ActionButton } from '../components/ui/ActionButton';
import { AlertCard } from '../components/ui/AlertCard';
import { EmptyState } from '../components/ui/EmptyState';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { MetricCard } from '../components/ui/MetricCard';
import { StatusBadge, type StatusTone } from '../components/ui/StatusBadge';
import { EnrollCustomerModal } from '../components/voiceprints/EnrollCustomerModal';
import { VerifyVoiceprintModal } from '../components/voiceprints/VerifyVoiceprintModal';
import { VoiceprintDetailModal } from '../components/voiceprints/VoiceprintDetailModal';
import { aegisApi } from '../services/api';
import type { VoiceprintRecord } from '../types/aegis';

function verificationTone(status: string): StatusTone {
  if (status === 'VERIFIED') return 'safe';
  if (status === 'MISMATCH') return 'threat';
  if (status === 'UNVERIFIED' || status === 'UNAVAILABLE') return 'caution';
  return 'neutral';
}

export function VoiceprintsPage() {
  const [voiceprints, setVoiceprints] = useState<VoiceprintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [verifyTargetId, setVerifyTargetId] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<VoiceprintRecord | null>(null);

  const loadVoiceprints = useCallback(async () => {
    try {
      setError(null);
      const data = await aegisApi.listVoiceprints();
      setVoiceprints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Voiceprint Library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVoiceprints();
  }, [loadVoiceprints]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return voiceprints.filter((vp) => {
      if (statusFilter !== 'ALL' && vp.status !== statusFilter) return false;
      if (!q) return true;
      return (
        vp.customer_id.toLowerCase().includes(q) ||
        vp.customer_name.toLowerCase().includes(q) ||
        (vp.provider_speaker_ref ?? '').toLowerCase().includes(q)
      );
    });
  }, [voiceprints, searchQuery, statusFilter]);

  const totalEnrolled = voiceprints.filter((v) => v.status === 'ACTIVE').length;
  const totalVerifications = voiceprints.reduce((sum, v) => sum + (v.verification_count || 0), 0);
  const totalMismatches = voiceprints.reduce((sum, v) => sum + (v.mismatch_count || 0), 0);
  const latestEnrolled = voiceprints[voiceprints.length - 1];

  const handleRevoke = async (voiceprintId: string) => {
    try {
      setError(null);
      const updated = await aegisApi.revokeVoiceprint(voiceprintId);
      setDetailRecord(updated);
      await loadVoiceprints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke enrollment.');
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#f8fafc]">AEGIS Voiceprint Library</h2>
          <p className="text-xs text-[#94a3b8]">
            Consent-governed speaker identity registry backed by DetectifAI Eidos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            variant="secondary"
            disabled={totalEnrolled === 0}
            icon={<Fingerprint className="h-3.5 w-3.5 text-sky-400" />}
            onClick={() => setVerifyTargetId(voiceprints.find((v) => v.status === 'ACTIVE')?.customer_id ?? '')}
          >
            Verify Caller Audio
          </ActionButton>
          <ActionButton
            variant="primary"
            size="md"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setEnrollOpen(true)}
          >
            ENROLL NEW CUSTOMER
          </ActionButton>
        </div>
      </div>

      {error && (
        <AlertCard
          tone="threat"
          title="Voiceprint Library Error"
          description={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 4 Library KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Enrolled Identities"
          value={totalEnrolled}
          subtitle={`${voiceprints.length} total records (${voiceprints.length - totalEnrolled} revoked)`}
          tone="info"
          icon={<ShieldCheck className="h-3.5 w-3.5 text-sky-400" />}
        />
        <MetricCard
          title="Recently Enrolled"
          value={latestEnrolled ? latestEnrolled.customer_name : 'None'}
          subtitle={
            latestEnrolled
              ? `${latestEnrolled.customer_id} · ${new Date(latestEnrolled.enrolled_at).toLocaleDateString()}`
              : 'No enrollments yet'
          }
          tone="safe"
          icon={<UserPlus className="h-3.5 w-3.5 text-[#22c55e]" />}
        />
        <MetricCard
          title="Verification Activity"
          value={totalVerifications}
          subtitle="Total Eidos / simulated speaker checks"
          tone="info"
          icon={<Activity className="h-3.5 w-3.5 text-sky-400" />}
        />
        <MetricCard
          title="Identity Mismatches"
          value={totalMismatches}
          subtitle="Flagged speaker verification failures"
          tone={totalMismatches > 0 ? 'threat' : 'safe'}
          icon={<ShieldAlert className="h-3.5 w-3.5 text-[#ef4444]" />}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-[#111827] p-3.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by Customer ID, Customer Name, or Eidos Speaker Reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#0a0f1e] py-2 pl-9 pr-3 text-xs text-[#f8fafc] focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0a0f1e] p-0.5">
          {(['ALL', 'ACTIVE', 'REVOKED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-md px-3 py-1 font-mono text-[11px] font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-[#151e30] text-sky-300'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Searchable Customer Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No Matching Voiceprint Identities"
          description={
            voiceprints.length === 0
              ? 'No customer voiceprints are enrolled yet. Enroll a customer with explicit consent to enable Eidos verification.'
              : 'Adjust your search query or status filter to locate an enrolled customer.'
          }
          action={
            <ActionButton variant="primary" onClick={() => setEnrollOpen(true)}>
              ENROLL NEW CUSTOMER
            </ActionButton>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-[#111827]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#151e30]/80 font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Enrollment Date</th>
                  <th className="px-4 py-3">Eidos Speaker Reference</th>
                  <th className="px-4 py-3">Last Verification</th>
                  <th className="px-4 py-3">Verification Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filtered.map((vp) => (
                  <tr key={vp.voiceprint_id} className="transition-colors hover:bg-[#151e30]/60">
                    <td className="px-4 py-3 font-mono font-semibold text-[#f8fafc]">
                      <div>{vp.customer_id}</div>
                      <div className="text-[10px] font-normal text-[#94a3b8]">
                        {vp.voiceprint_id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#f8fafc]">{vp.customer_name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-[11px] text-[#94a3b8]">{vp.account_tier}</span>
                        <ProvenanceBadge provenance={vp.enrollment_source} compact />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#94a3b8]">
                      {new Date(vp.enrolled_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-sky-300">
                      {vp.provider_speaker_ref ?? 'PENDING'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#94a3b8]">
                      {vp.last_verified_at
                        ? `${new Date(vp.last_verified_at).toLocaleDateString()} (${
                            vp.last_match_percentage !== null
                              ? `${vp.last_match_percentage.toFixed(1)}%`
                              : 'N/A'
                          })`
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge
                          label={
                            vp.status === 'REVOKED' ? 'REVOKED' : vp.last_verification_status
                          }
                          tone={
                            vp.status === 'REVOKED'
                              ? 'threat'
                              : verificationTone(vp.last_verification_status)
                          }
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {vp.status === 'ACTIVE' && (
                          <ActionButton
                            variant="primary"
                            onClick={() => setVerifyTargetId(vp.customer_id)}
                          >
                            Verify
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="secondary"
                          onClick={() => setDetailRecord(vp)}
                        >
                          Details
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EnrollCustomerModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={loadVoiceprints}
      />

      <VerifyVoiceprintModal
        open={verifyTargetId !== null}
        onClose={() => setVerifyTargetId(null)}
        voiceprints={voiceprints}
        initialCustomerId={verifyTargetId ?? undefined}
        onVerified={loadVoiceprints}
      />

      <VoiceprintDetailModal
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onRevoke={handleRevoke}
      />
    </div>
  );
}
