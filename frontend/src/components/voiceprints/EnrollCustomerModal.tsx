import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileAudio, Mic, ShieldCheck, Square } from 'lucide-react';
import { aegisApi } from '../../services/api';
import { ActionButton } from '../ui/ActionButton';
import { AlertCard } from '../ui/AlertCard';
import { Modal } from '../ui/Modal';

interface EnrollCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => Promise<void>;
}

export function EnrollCustomerModal({ open, onClose, onEnrolled }: EnrollCustomerModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [accountTier, setAccountTier] = useState('Private Banking');
  const [purpose, setPurpose] = useState('Banking Call Authentication & Wire Fraud Prevention');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedFilename, setCapturedFilename] = useState<string>('voice_sample.webm');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setRecording(false);
      setError(null);
    }
  }, [open]);

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const startRecording = async () => {
    if (!consentConfirmed) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone capture API unavailable in this browser. Upload an audio file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setCapturedBlob(blob);
        setCapturedFilename('mic_enrollment.webm');
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError('Microphone permission denied or unavailable. You can upload an audio file instead.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentConfirmed || !customerId.trim() || !customerName.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      if (capturedBlob) {
        await aegisApi.enrollVoiceprintAudio({
          file: capturedBlob,
          filename: capturedFilename,
          customer_id: customerId.trim(),
          customer_name: customerName.trim(),
          account_tier: accountTier,
          enrollment_purpose: purpose,
          consent_confirmed: consentConfirmed,
          sample_duration_sec: Math.max(4.0, recordSeconds || 6.0),
        });
      } else {
        await aegisApi.enrollVoiceprint({
          customer_id: customerId.trim(),
          customer_name: customerName.trim(),
          account_tier: accountTier,
          enrollment_purpose: purpose,
          consent_confirmed: consentConfirmed,
          sample_duration_sec: 6.0,
        });
      }
      setCustomerName('');
      setCustomerId('');
      setConsentConfirmed(false);
      setCapturedBlob(null);
      await onEnrolled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voiceprint enrollment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ENROLL NEW CUSTOMER VOICEPRINT"
      subtitle="Consent-First Speaker Registration via DetectifAI Eidos"
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AlertCard tone="threat" title="Enrollment Error" description={error} />}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94a3b8]">
              Customer Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Clara Vance"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-xs text-[#f8fafc] focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94a3b8]">
              Customer Reference ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CUST-5102-CLARA"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#0a0f1e] px-3 py-2 font-mono text-xs text-[#f8fafc] focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94a3b8]">
              Account Tier
            </label>
            <select
              value={accountTier}
              onChange={(e) => setAccountTier(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-xs text-[#f8fafc]"
            >
              <option value="Private Banking">Private Banking</option>
              <option value="Commercial Treasury">Commercial Treasury</option>
              <option value="Retail Premier">Retail Premier</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94a3b8]">
              Purpose of Enrollment *
            </label>
            <input
              type="text"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-xs text-[#f8fafc]"
            />
          </div>
        </div>

        {/* Explicit Consent Notice */}
        <div className="rounded-lg border border-sky-500/30 bg-[#151e30] p-3.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-sky-300">
            <ShieldCheck className="h-4 w-4" />
            Explicit Voice Biometric Consent Notice
          </div>
          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-[#94a3b8]">
            <li>
              • <strong className="text-[#f8fafc]">Why enrolled:</strong> To verify the caller&apos;s
              spoken identity during banking support and high-value transaction requests.
            </li>
            <li>
              • <strong className="text-[#f8fafc]">How used:</strong> Audio is forwarded to
              DetectifAI Eidos to generate a speaker reference ID; raw enrollment audio is not
              stored on disk by AEGIS.
            </li>
            <li>
              • <strong className="text-[#f8fafc]">Retention policy:</strong> The speaker reference
              and enrollment metadata remain active until explicitly revoked by an authorized SOC
              operator.
            </li>
            <li>
              • <strong className="text-[#f8fafc]">Revocation:</strong> Enrollment can be revoked
              immediately at any time from the Voiceprint Library table.
            </li>
          </ul>

          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded border border-slate-700 bg-[#0a0f1e]/80 p-2.5">
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              className="mt-0.5 accent-sky-400"
            />
            <span className="text-xs font-medium text-[#f8fafc]">
              I confirm that the customer has given explicit informed consent for voiceprint
              enrollment under the stated purpose and retention policy.
            </span>
          </label>
        </div>

        {/* Voice Sample Capture (locked until consentConfirmed) */}
        <div
          className={`rounded-lg border border-slate-800 bg-[#0a0f1e]/70 p-3.5 transition-opacity ${
            !consentConfirmed ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#f8fafc]">
              Voice Sample Capture (4–15s recommended)
            </span>
            {capturedBlob && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#22c55e]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Audio ready ({Math.round(capturedBlob.size / 1024)} KB)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <ActionButton
                variant="primary"
                disabled={!consentConfirmed}
                icon={<Mic className="h-3.5 w-3.5" />}
                onClick={() => void startRecording()}
              >
                Capture Microphone Sample
              </ActionButton>
            ) : (
              <ActionButton
                variant="threat"
                icon={<Square className="h-3.5 w-3.5" />}
                onClick={stopRecording}
              >
                Stop Recording ({recordSeconds}s)
              </ActionButton>
            )}

            <label
              className={`inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-[#151e30] px-3 py-1.5 text-xs font-medium text-[#f8fafc] ${
                consentConfirmed ? 'cursor-pointer hover:border-slate-600' : 'pointer-events-none'
              }`}
            >
              <FileAudio className="h-3.5 w-3.5 text-sky-400" />
              Upload Audio File
              <input
                type="file"
                accept="audio/*"
                disabled={!consentConfirmed}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCapturedBlob(file);
                    setCapturedFilename(file.name);
                  }
                }}
              />
            </label>
          </div>
          {!capturedBlob && (
            <p className="mt-2 text-[11px] text-[#94a3b8]">
              Without an audio file in DEMO mode, enrollment creates a clearly labelled SIMULATION
              speaker reference.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!consentConfirmed || !customerId.trim() || !customerName.trim()}
          >
            Enroll Customer Voiceprint
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
