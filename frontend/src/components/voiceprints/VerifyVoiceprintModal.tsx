import { useEffect, useRef, useState } from 'react';
import { FileAudio, Mic, Square } from 'lucide-react';
import { useAegis } from '../../hooks/useAegis';
import { aegisApi } from '../../services/api';
import type { VoiceprintRecord, VoiceprintVerifyResponse } from '../../types/aegis';
import { SpeakerMatchRing } from '../charts/SpeakerMatchRing';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { ActionButton } from '../ui/ActionButton';
import { AlertCard } from '../ui/AlertCard';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';

interface VerifyVoiceprintModalProps {
  open: boolean;
  onClose: () => void;
  voiceprints: VoiceprintRecord[];
  initialCustomerId?: string;
  onVerified: () => Promise<void>;
}

export function VerifyVoiceprintModal({
  open,
  onClose,
  voiceprints,
  initialCustomerId,
  onVerified,
}: VerifyVoiceprintModalProps) {
  const { health } = useAegis();
  const activeVps = voiceprints.filter((v) => v.status === 'ACTIVE');
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialCustomerId || activeVps[0]?.customer_id || '',
  );
  const [simOutcome, setSimOutcome] = useState<'match' | 'mismatch'>('match');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState('verify_sample.webm');
  const [recording, setRecording] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VoiceprintVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedCustomerId(initialCustomerId || activeVps[0]?.customer_id || '');
      setResult(null);
      setError(null);
      setAudioBlob(null);
    }
  }, [open, initialCustomerId]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const effectiveCustomerId = selectedCustomerId || initialCustomerId || activeVps[0]?.customer_id || '';

  const startMic = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone capture unavailable. Upload an audio sample instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        setFilename('live_verify.webm');
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError('Microphone access denied. Upload an audio file instead.');
    }
  };

  const stopMic = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleVerify = async () => {
    if (!effectiveCustomerId) return;
    try {
      setVerifying(true);
      setError(null);
      const res = await aegisApi.verifyVoiceprint({
        claimed_customer_id: effectiveCustomerId,
        file: audioBlob ?? undefined,
        filename,
        simulate_outcome: simOutcome,
      });
      setResult(res);
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="VERIFY SPEAKER IDENTITY (EIDOS)"
      subtitle={`Mode: ${health?.app_mode ?? 'DEMO'} · Compare new audio against enrolled speaker reference`}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        {error && <AlertCard tone="threat" title="Verification Error" description={error} />}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94a3b8]">
            Select Enrolled Customer
          </label>
          <select
            value={effectiveCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value);
              setResult(null);
            }}
            className="w-full rounded-md border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-xs text-[#f8fafc]"
          >
            {activeVps.map((vp) => (
              <option key={vp.voiceprint_id} value={vp.customer_id}>
                {vp.customer_name} ({vp.customer_id})
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#151e30] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <ActionButton
                variant="primary"
                icon={<Mic className="h-3.5 w-3.5" />}
                onClick={() => void startMic()}
              >
                Capture Verification Audio
              </ActionButton>
            ) : (
              <ActionButton
                variant="threat"
                icon={<Square className="h-3.5 w-3.5" />}
                onClick={stopMic}
              >
                Stop Capture
              </ActionButton>
            )}

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 bg-[#0a0f1e] px-3 py-1.5 text-xs font-medium text-[#f8fafc] hover:border-slate-600">
              <FileAudio className="h-3.5 w-3.5 text-sky-400" />
              Upload Audio
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setAudioBlob(f);
                    setFilename(f.name);
                  }
                }}
              />
            </label>
          </div>

          {health?.app_mode === 'DEMO' && (
            <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
              <span className="text-[#94a3b8]">DEMO Simulation Outcome:</span>
              <select
                value={simOutcome}
                onChange={(e) => setSimOutcome(e.target.value as 'match' | 'mismatch')}
                className="rounded border border-slate-700 bg-[#0a0f1e] px-2 py-1 font-mono text-xs text-[#f8fafc]"
              >
                <option value="match">Simulated Match (93.4%)</option>
                <option value="mismatch">Simulated Mismatch (21.5%)</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={onClose}>
            Close
          </ActionButton>
          <ActionButton
            variant="primary"
            loading={verifying}
            disabled={!effectiveCustomerId}
            onClick={() => void handleVerify()}
          >
            Run Eidos Verification
          </ActionButton>
        </div>

        {result && (
          <div className="animate-alert-in rounded-xl border border-slate-700 bg-[#0a0f1e] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <SpeakerMatchRing percentage={result.match_percentage} size={74} />
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={result.verification_result}
                      tone={
                        result.verification_result === 'VERIFIED'
                          ? 'safe'
                          : result.verification_result === 'MISMATCH'
                            ? 'threat'
                            : 'caution'
                      }
                    />
                    <ProvenanceBadge provenance={result.provenance} compact />
                  </div>
                  <div className="mt-1.5 space-y-0.5 font-mono text-xs text-[#94a3b8]">
                    <div>Claimed: {result.claimed_identity}</div>
                    <div>Verified: {result.verified_identity ?? 'NONE'}</div>
                    <div>Timestamp: {new Date(result.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2.5 border-t border-slate-800 pt-2 text-xs text-[#94a3b8]">
              {result.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
