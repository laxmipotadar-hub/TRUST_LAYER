import { Clock, ShieldCheck, ShieldOff } from 'lucide-react';
import type { VoiceprintRecord } from '../../types/aegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { ActionButton } from '../ui/ActionButton';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';

interface VoiceprintDetailModalProps {
  record: VoiceprintRecord | null;
  onClose: () => void;
  onRevoke: (voiceprintId: string) => Promise<void>;
}

export function VoiceprintDetailModal({
  record,
  onClose,
  onRevoke,
}: VoiceprintDetailModalProps) {
  if (!record) return null;

  return (
    <Modal
      open={Boolean(record)}
      onClose={onClose}
      title={record.customer_name}
      subtitle={`Voiceprint ${record.voiceprint_id} · ${record.customer_id}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge
              label={record.status}
              tone={record.status === 'ACTIVE' ? 'safe' : 'threat'}
            />
            <ProvenanceBadge provenance={record.enrollment_source} compact />
          </div>
          <span className="font-mono text-[#94a3b8]">
            Eidos Ref: {record.provider_speaker_ref ?? 'N/A'}
          </span>
        </div>

        {/* Consent & Retention Metadata */}
        <div className="rounded-lg border border-slate-800 bg-[#151e30] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-sky-300">
            <ShieldCheck className="h-4 w-4" />
            Consent &amp; Retention Metadata
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-[11px] text-[#94a3b8]">
            <div>
              <strong className="text-[#f8fafc]">Purpose:</strong> {record.enrollment_purpose}
            </div>
            <div>
              <strong className="text-[#f8fafc]">Consent Confirmed:</strong>{' '}
              {record.consent_confirmed ? 'Yes' : 'No'} (
              {record.consent_timestamp || record.enrolled_at})
            </div>
            <div>
              <strong className="text-[#f8fafc]">Retention Policy:</strong> {record.retention_policy}
            </div>
            {record.revoked_at && (
              <div className="text-[#ef4444]">
                <strong>Revoked At:</strong> {record.revoked_at}
              </div>
            )}
          </div>
        </div>

        {/* Verification History */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[#94a3b8]">
            <Clock className="h-3.5 w-3.5 text-sky-400" />
            Verification History ({record.verification_history.length})
          </div>

          {record.verification_history.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-[#0a0f1e]/60 px-3 py-4 text-center text-[#94a3b8]">
              No live verification attempts logged yet for this profile.
            </div>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {record.verification_history.map((item) => (
                <div
                  key={item.verification_id}
                  className="rounded-lg border border-slate-800 bg-[#0a0f1e]/80 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#f8fafc]">
                      {item.verification_id} · Match:{' '}
                      {item.match_percentage !== null ? `${item.match_percentage.toFixed(1)}%` : 'N/A'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ProvenanceBadge provenance={item.provenance} compact />
                      <StatusBadge
                        label={item.result}
                        tone={
                          item.result === 'VERIFIED'
                            ? 'safe'
                            : item.result === 'MISMATCH'
                              ? 'threat'
                              : 'caution'
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">{item.notes}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          {record.status === 'ACTIVE' ? (
            <ActionButton
              variant="threat"
              icon={<ShieldOff className="h-3.5 w-3.5" />}
              onClick={() => void onRevoke(record.voiceprint_id)}
            >
              Revoke Enrollment
            </ActionButton>
          ) : (
            <span className="font-mono text-[11px] text-[#ef4444]">Enrollment Revoked</span>
          )}
          <ActionButton variant="primary" onClick={onClose}>
            Close
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
