import { useState } from 'react';
import { Network, Plus, ShieldAlert, ShieldCheck, Tag } from 'lucide-react';
import { useAegis } from '../../hooks/useAegis';
import { aegisApi } from '../../services/api';
import type {
  ThreatRegistryResponse,
  ThreatSeverity,
  ThreatVerificationStatus,
} from '../../types/aegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { ActionButton } from '../ui/ActionButton';
import { AlertCard } from '../ui/AlertCard';
import { MetricCard } from '../ui/MetricCard';
import { Modal } from '../ui/Modal';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

interface ThreatRegistryPanelProps {
  registry: ThreatRegistryResponse;
  onRefresh: () => Promise<void>;
}

function severityTone(sev: ThreatSeverity): StatusTone {
  if (sev === 'CRITICAL' || sev === 'HIGH') return 'threat';
  if (sev === 'MEDIUM') return 'caution';
  return 'safe';
}

function statusTone(st: ThreatVerificationStatus): StatusTone {
  if (st === 'CONFIRMED THREAT') return 'threat';
  if (st === 'MITIGATED') return 'safe';
  return 'caution';
}

export function ThreatRegistryPanel({ registry, onRefresh }: ThreatRegistryPanelProps) {
  const { currentCall } = useAegis();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  const [patternName, setPatternName] = useState('');
  const [rawSpeakerRef, setRawSpeakerRef] = useState('');
  const [category, setCategory] = useState('AI Voice Synthesis');
  const [severity, setSeverity] = useState<ThreatSeverity>('HIGH');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [indicatorsText, setIndicatorsText] = useState('');
  const [authorized, setAuthorized] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = registry.entries.filter(
    (e) => selectedCategory === 'ALL' || e.category === selectedCategory,
  );
  const confirmedCount = registry.entries.filter(
    (e) => e.verification_status === 'CONFIRMED THREAT',
  ).length;
  const uniqueAnonIdentities = new Set(registry.entries.map((e) => e.anonymous_speaker_ref)).size;

  const openFromCurrentCall = () => {
    if (currentCall) {
      setPatternName(
        currentCall.scam_analysis.detected_patterns?.[0] ||
          currentCall.scam_analysis.categories[0] ||
          currentCall.caller_label,
      );
      setRawSpeakerRef(currentCall.claimed_customer_id || currentCall.call_id);
      setCategory(
        currentCall.voice_authenticity.status === 'FAIL'
          ? 'AI Voice Synthesis'
          : !currentCall.liveness.passed
            ? 'Replay Attack'
            : 'Authorized Push Payment Scam',
      );
      setSeverity(currentCall.trust_breakdown.final_decision === 'THREAT' ? 'CRITICAL' : 'HIGH');
      setEvidenceRef(`${currentCall.call_id} · ${currentCall.trust_breakdown.final_decision}`);
      setIndicatorsText(
        [
          ...currentCall.voice_authenticity.artifacts_detected,
          ...currentCall.scam_analysis.flagged_phrases.map((f) => f.phrase),
        ]
          .slice(0, 4)
          .join(', '),
      );
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patternName.trim() || !rawSpeakerRef.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      await aegisApi.submitThreatRecord({
        pattern_name: patternName.trim(),
        raw_speaker_reference: rawSpeakerRef.trim(),
        category: category.trim(),
        severity,
        evidence_reference: evidenceRef.trim(),
        indicators: indicatorsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        operator_authorized: authorized,
      });
      setModalOpen(false);
      setPatternName('');
      setRawSpeakerRef('');
      setIndicatorsText('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit threat record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    entryId: string,
    nextStatus: ThreatVerificationStatus,
  ) => {
    try {
      setError(null);
      await aegisApi.updateThreatStatus(entryId, nextStatus);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update verification status.');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-[#111827] p-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-[#f8fafc]">
              Community Threat Intelligence — &ldquo;One victim&apos;s bad call becomes everyone&apos;s vaccine.&rdquo;
            </h3>
          </div>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Anonymized threat intelligence schema designed for multi-institution sharing. Raw
            voiceprints and customer PII are never exposed; this prototype operates on a local SOC
            instance (no external banks connected).
          </p>
        </div>

        <ActionButton
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" />}
          onClick={openFromCurrentCall}
        >
          Flag Suspicious Voice / Pattern
        </ActionButton>
      </div>

      {error && (
        <AlertCard
          tone="threat"
          title="Threat Registry Error"
          description={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Registry Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Known Suspicious Identities"
          value={uniqueAnonIdentities}
          subtitle="SHA-256 anonymized speaker refs"
          tone="threat"
          icon={<ShieldAlert className="h-3.5 w-3.5 text-[#ef4444]" />}
        />
        <MetricCard
          title="Recently Flagged Threats"
          value={registry.total}
          subtitle="Stored in local threat registry"
          tone="info"
          icon={<Network className="h-3.5 w-3.5 text-sky-400" />}
        />
        <MetricCard
          title="Threat Categories"
          value={registry.categories.length}
          subtitle="Distinct attack classifications"
          tone="caution"
          icon={<Tag className="h-3.5 w-3.5 text-[#f59e0b]" />}
        />
        <MetricCard
          title="Confirmed Threats"
          value={confirmedCount}
          subtitle="Verified by authorized SOC operators"
          tone="safe"
          icon={<ShieldCheck className="h-3.5 w-3.5 text-[#22c55e]" />}
        />
      </div>

      {/* Category Filter Strip */}
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', ...registry.categories].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              selectedCategory === cat
                ? 'border-sky-500/60 bg-[#151e30] text-sky-300'
                : 'border-slate-800 bg-[#111827] text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Threat Entries List */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.entry_id}
            className="rounded-xl border border-slate-800/90 bg-[#111827] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-400">
                    {entry.entry_id}
                  </span>
                  <span className="text-sm font-semibold text-[#f8fafc]">{entry.pattern_name}</span>
                  <ProvenanceBadge provenance={entry.provenance} compact />
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#94a3b8]">
                  <span>
                    Anon Speaker: <strong className="text-[#f8fafc]">{entry.anonymous_speaker_ref}</strong>
                  </span>
                  <span>Category: {entry.category}</span>
                  <span>
                    Detected: {new Date(entry.detection_date || entry.last_seen).toLocaleString()}
                  </span>
                  <span>Evidence: {entry.evidence_reference || 'N/A'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={entry.severity} tone={severityTone(entry.severity)} />
                <StatusBadge
                  label={entry.verification_status}
                  tone={statusTone(entry.verification_status)}
                />
              </div>
            </div>

            {entry.indicators.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {entry.indicators.map((ind, idx) => (
                  <span
                    key={idx}
                    className="rounded border border-slate-700 bg-[#0a0f1e] px-2 py-0.5 font-mono text-[10px] text-[#94a3b8]"
                  >
                    {ind}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2.5 text-[11px]">
              <span className="text-[#94a3b8]">{entry.institution_scope}</span>
              <div className="flex gap-1.5">
                <ActionButton
                  variant="threat"
                  disabled={entry.verification_status === 'CONFIRMED THREAT'}
                  onClick={() => void handleStatusChange(entry.entry_id, 'CONFIRMED THREAT')}
                >
                  Confirm Threat
                </ActionButton>
                <ActionButton
                  variant="safe"
                  disabled={entry.verification_status === 'MITIGATED'}
                  onClick={() => void handleStatusChange(entry.entry_id, 'MITIGATED')}
                >
                  Mark Mitigated
                </ActionButton>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Submit Threat Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="SUBMIT ANONYMIZED THREAT RECORD"
        subtitle="Speaker identifiers are hashed via SHA-256 server-side; zero PII or raw audio stored"
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block text-[11px] text-[#94a3b8]">Threat Pattern Name *</label>
            <input
              type="text"
              required
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="e.g. Executive Voice Clone Wire Request"
              className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-[#f8fafc]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-[#94a3b8]">
                Source Ref (Hashed to Anonymous ID) *
              </label>
              <input
                type="text"
                required
                value={rawSpeakerRef}
                onChange={(e) => setRawSpeakerRef(e.target.value)}
                placeholder="e.g. CALL-XXXX or speaker ref"
                className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-3 py-2 font-mono text-[#f8fafc]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-[#94a3b8]">Threat Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-[#f8fafc]"
              >
                <option value="AI Voice Synthesis">AI Voice Synthesis</option>
                <option value="Replay Attack">Replay Attack</option>
                <option value="Authorized Push Payment Scam">Authorized Push Payment Scam</option>
                <option value="Credential Harvesting">Credential Harvesting</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-[#94a3b8]">Risk Classification</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ThreatSeverity)}
                className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-[#f8fafc]"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-[#94a3b8]">Evidence Reference</label>
              <input
                type="text"
                value={evidenceRef}
                onChange={(e) => setEvidenceRef(e.target.value)}
                placeholder="e.g. CALL-1234 · S2 Vocoder"
                className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-3 py-2 font-mono text-[#f8fafc]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-[#94a3b8]">
              Indicators (comma-separated)
            </label>
            <input
              type="text"
              value={indicatorsText}
              onChange={(e) => setIndicatorsText(e.target.value)}
              placeholder="e.g. vocoder discontinuity, OTP request, urgency"
              className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-[#f8fafc]"
            />
          </div>

          <label className="flex items-center gap-2 rounded border border-slate-800 bg-[#151e30] p-2.5">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              className="accent-sky-400"
            />
            <span>Confirm SOC operator authorization to publish anonymized threat record.</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" variant="primary" loading={submitting} disabled={!authorized}>
              Publish Anonymized Threat
            </ActionButton>
          </div>
        </form>
      </Modal>
    </section>
  );
}
