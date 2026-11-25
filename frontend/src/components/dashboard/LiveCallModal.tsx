import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileAudio,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  Square,
} from 'lucide-react';
import { useAegis } from '../../hooks/useAegis';
import { aegisApi } from '../../services/api';
import type {
  AnalysisMode,
  UnifiedCallAnalysisResponse,
  VoiceprintRecord,
} from '../../types/aegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { ActionButton } from '../ui/ActionButton';
import { AlertCard } from '../ui/AlertCard';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';

type MicStatus =
  | 'READY'
  | 'REQUESTING PERMISSION'
  | 'RECORDING'
  | 'CAPTURED'
  | 'PERMISSION DENIED'
  | 'UNSUPPORTED';

type PipelineStepKey = 'audio' | 'aletheia' | 'eidos' | 'scam' | 'trust';

interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechCtor(): (new () => SpeechRecLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecLike;
    webkitSpeechRecognition?: new () => SpeechRecLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function LiveCallModal() {
  const {
    health,
    liveCallModalOpen,
    closeLiveCallModal,
    applyAnalyzedCall,
  } = useAegis();

  const [voiceprints, setVoiceprints] = useState<VoiceprintRecord[]>([]);
  const [claimedId, setClaimedId] = useState('CUST-4821-MARCUS');
  const [callerLabel, setCallerLabel] = useState('Live Microphone Call');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(
    health?.app_mode === 'REAL' ? 'REAL' : 'SIMULATION',
  );

  const [micStatus, setMicStatus] = useState<MicStatus>('READY');
  const [recordingSec, setRecordingSec] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFilename, setAudioFilename] = useState('live_call.webm');
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState<PipelineStepKey | null>(null);
  const [result, setResult] = useState<UnifiedCallAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRef = useRef<SpeechRecLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const cleanupMedia = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {
        // ignore
      }
      speechRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!liveCallModalOpen) {
      cleanupMedia();
      return;
    }

    setSpeechSupported(getSpeechCtor() !== null);
    setAnalysisMode(health?.app_mode === 'REAL' ? 'REAL' : 'SIMULATION');
    setError(null);
    setResult(null);
    setActiveStep(null);

    aegisApi
      .listVoiceprints()
      .then((list) => setVoiceprints(list.filter((v) => v.status === 'ACTIVE')))
      .catch(() => {});
  }, [liveCallModalOpen, health?.app_mode, cleanupMedia]);

  const startLiveRecording = async () => {
    setError(null);
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicStatus('UNSUPPORTED');
      setError('Microphone recording API is unsupported in this browser. Upload an audio file below.');
      return;
    }

    setMicStatus('REQUESTING PERMISSION');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioFilename('live_microphone.webm');
        setMicStatus('CAPTURED');
      };

      recorder.start(500);
      recorderRef.current = recorder;
      setMicStatus('RECORDING');
      setRecordingSec(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSec((prev) => prev + 1);
      }, 1000);

      const SpeechCtor = getSpeechCtor();
      if (SpeechCtor) {
        try {
          const rec = new SpeechCtor();
          rec.lang = 'en-US';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev) => {
            const collected: string[] = [];
            for (let i = 0; i < ev.results.length; i++) {
              const txt = ev.results[i]?.[0]?.transcript;
              if (txt) collected.push(txt);
            }
            setTranscript(collected.join(' ').trim());
          };
          rec.onerror = () => {};
          rec.start();
          speechRef.current = rec;
        } catch {
          // SpeechRecognition optional; MediaRecorder still captures audio
        }
      }
    } catch {
      setMicStatus('PERMISSION DENIED');
      setError(
        'Microphone permission denied or device unavailable. Grant microphone access or upload an audio sample below.',
      );
    }
  };

  const stopLiveRecording = () => {
    cleanupMedia();
  };

  const submitAnalysis = async (modeOverride?: AnalysisMode) => {
    const effectiveMode = modeOverride ?? analysisMode;
    setError(null);

    if (audioBlob && recordingSec > 0 && recordingSec < 4 && effectiveMode === 'REAL') {
      setError(
        `Captured audio is ${recordingSec}s. DetectifAI Aletheia requires at least 4.0 seconds; record >= 4s or run SIMULATION mode.`,
      );
      return;
    }

    try {
      setAnalyzing(true);
      setActiveStep('audio');
      await new Promise((r) => setTimeout(r, 150));
      setActiveStep('aletheia');

      const response = await aegisApi.analyzeLiveCall({
        file: audioBlob ?? undefined,
        filename: audioFilename,
        transcript_text:
          transcript.trim() || 'Caller checking account balance and recent card transactions.',
        claimed_customer_id: claimedId,
        caller_label: callerLabel.trim() || 'Live Call Analysis',
        analysis_mode: effectiveMode,
        duration_hint_sec: recordingSec > 0 ? recordingSec : undefined,
      });

      setActiveStep('eidos');
      await new Promise((r) => setTimeout(r, 120));
      setActiveStep('scam');
      await new Promise((r) => setTimeout(r, 120));
      setActiveStep('trust');

      setResult(response);
      await applyAnalyzedCall(response.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live call analysis request failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const pipelineRows: { key: PipelineStepKey; label: string; statusText: string }[] = [
    {
      key: 'audio',
      label: 'LIVE AUDIO CAPTURED',
      statusText: audioBlob ? `${Math.round(audioBlob.size / 1024)} KB` : 'Text / No Audio',
    },
    {
      key: 'aletheia',
      label: 'ALETHEIA ANALYZING',
      statusText: result?.model_status.aletheia ?? (analyzing && activeStep === 'aletheia' ? 'RUNNING' : 'PENDING'),
    },
    {
      key: 'eidos',
      label: 'EIDOS VERIFYING',
      statusText: result?.model_status.eidos ?? (analyzing && activeStep === 'eidos' ? 'RUNNING' : 'PENDING'),
    },
    {
      key: 'scam',
      label: 'SCAM ANALYSIS RUNNING',
      statusText: result?.model_status.scam_analysis ?? (analyzing && activeStep === 'scam' ? 'RUNNING' : 'PENDING'),
    },
    {
      key: 'trust',
      label: 'TRUST SCORE UPDATING',
      statusText: result ? `${result.verdict}` : 'PENDING',
    },
  ];

  const hasUnavailableRealModel =
    result &&
    result.analysis_mode === 'REAL' &&
    (result.verdict === 'INCOMPLETE ANALYSIS' ||
      result.model_status.aletheia !== 'OK' ||
      result.model_status.eidos === 'UNAVAILABLE');

  return (
    <Modal
      open={liveCallModalOpen}
      onClose={() => {
        cleanupMedia();
        closeLiveCallModal();
      }}
      title="LIVE CALL ANALYSIS"
      subtitle="Capture microphone audio, run Aletheia + Eidos + Scam & Pressure analysis, and update Dashboard"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        {error && <AlertCard tone="threat" title="Live Call Error" description={error} />}

        {/* Configuration Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-[#94a3b8]">Claimed Customer</label>
            <select
              value={claimedId}
              onChange={(e) => setClaimedId(e.target.value)}
              className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-2.5 py-2 font-mono text-[#f8fafc]"
            >
              {voiceprints.map((vp) => (
                <option key={vp.voiceprint_id} value={vp.customer_id}>
                  {vp.customer_name} ({vp.customer_id})
                </option>
              ))}
              <option value="CUST-UNENROLLED-CALLER">Unenrolled Caller (Neutral 50)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-[#94a3b8]">Caller Label</label>
            <input
              type="text"
              value={callerLabel}
              onChange={(e) => setCallerLabel(e.target.value)}
              className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-2.5 py-2 text-[#f8fafc]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-[#94a3b8]">Analysis Mode</label>
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value as AnalysisMode)}
              className="w-full rounded border border-slate-700 bg-[#0a0f1e] px-2.5 py-2 font-mono text-[#f8fafc]"
            >
              <option value="REAL">REAL (Live AI APIs)</option>
              <option value="CACHED">CACHED (Stored Only)</option>
              <option value="SIMULATION">SIMULATION (Demo Safe)</option>
            </select>
          </div>
        </div>

        {/* Microphone Capture Box */}
        <div className="rounded-xl border border-slate-800 bg-[#151e30] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge
                label={`MIC: ${micStatus}`}
                tone={
                  micStatus === 'RECORDING'
                    ? 'safe'
                    : micStatus === 'PERMISSION DENIED' || micStatus === 'UNSUPPORTED'
                      ? 'threat'
                      : micStatus === 'CAPTURED'
                        ? 'info'
                        : 'neutral'
                }
                dot
                pulse={micStatus === 'RECORDING'}
                icon={micStatus === 'RECORDING' ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              />
              <span className="font-mono text-sm font-bold text-[#f8fafc]">
                {formatTimer(recordingSec)}
              </span>
              {recordingSec > 0 && recordingSec < 4 && (
                <span className="font-mono text-[10px] text-[#f59e0b]">
                  (Min 4.0s for Aletheia)
                </span>
              )}
            </div>

            <span className="font-mono text-[10px] text-[#94a3b8]">
              Speech-to-Text: {speechSupported ? 'AVAILABLE' : 'MANUAL TRANSCRIPT'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {micStatus !== 'RECORDING' ? (
              <ActionButton
                variant="primary"
                size="md"
                icon={<PhoneCall className="h-3.5 w-3.5" />}
                onClick={() => void startLiveRecording()}
              >
                Start Microphone Capture
              </ActionButton>
            ) : (
              <ActionButton
                variant="threat"
                size="md"
                icon={<Square className="h-3.5 w-3.5" />}
                onClick={stopLiveRecording}
              >
                Stop Recording ({recordingSec}s)
              </ActionButton>
            )}

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 bg-[#0a0f1e] px-3 py-2 text-xs font-medium text-[#f8fafc] hover:border-slate-600">
              <FileAudio className="h-3.5 w-3.5 text-sky-400" />
              Upload Audio (.wav / .webm)
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAudioBlob(file);
                    setAudioFilename(file.name);
                    setMicStatus('CAPTURED');
                    setRecordingSec(6);
                  }
                }}
              />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-[#94a3b8]">
              Live Transcript (auto-populated by SpeechRecognition when supported, or enter call text)
            </label>
            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Speak into microphone or enter call transcript to analyze scam & behavioral-pressure risk..."
              className="w-full rounded border border-slate-700 bg-[#0a0f1e] p-2.5 text-xs text-[#f8fafc]"
            />
          </div>
        </div>

        {/* Real-Time Pipeline Status */}
        {(analyzing || result) && (
          <div className="space-y-1.5 rounded-xl border border-slate-800 bg-[#0a0f1e] p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
                Real-Time Analysis Pipeline
              </span>
              {result && <ProvenanceBadge provenance={result.session.overall_provenance} compact />}
            </div>
            {pipelineRows.map((row) => {
              const isCurrent = analyzing && activeStep === row.key;
              const isOk = row.statusText === 'OK' || row.statusText === 'CACHED' || row.statusText === 'SAFE';
              const isWarnOrFail =
                row.statusText === 'UNAVAILABLE' ||
                row.statusText === 'AUTH_ERROR' ||
                row.statusText === 'TIMEOUT' ||
                row.statusText === 'RATE_LIMITED' ||
                row.statusText === 'INVALID_AUDIO' ||
                row.statusText === 'INCOMPLETE ANALYSIS' ||
                row.statusText === 'THREAT' ||
                row.statusText === 'CACHE_MISS';

              return (
                <div
                  key={row.key}
                  className="flex items-center justify-between rounded border border-slate-800/80 bg-[#111827] px-3 py-1.5 font-mono text-[11px]"
                >
                  <span className="flex items-center gap-2 text-[#f8fafc]">
                    {isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                    ) : (
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${
                          isWarnOrFail ? 'text-[#f59e0b]' : isOk ? 'text-[#22c55e]' : 'text-slate-500'
                        }`}
                      />
                    )}
                    {row.label}
                  </span>
                  <StatusBadge
                    label={row.statusText}
                    tone={isWarnOrFail ? 'caution' : isOk ? 'safe' : 'neutral'}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Honest Incomplete/Error Fallback Banner */}
        {hasUnavailableRealModel && (
          <AlertCard
            tone="caution"
            title="Real AI Service Unavailable — Incomplete Analysis"
            description="One or more required live AI endpoints (Aletheia/Eidos) were unavailable or missing credentials. AEGIS refused to fabricate a SAFE score. You can explicitly retry in SIMULATION mode."
            action={
              <ActionButton variant="caution" onClick={() => void submitAnalysis('SIMULATION')}>
                Retry as SIMULATION
              </ActionButton>
            }
          />
        )}

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <ActionButton
            variant="secondary"
            onClick={() => {
              cleanupMedia();
              closeLiveCallModal();
            }}
          >
            {result ? 'View Updated Dashboard' : 'Cancel'}
          </ActionButton>

          <ActionButton
            variant="primary"
            size="md"
            loading={analyzing}
            disabled={micStatus === 'RECORDING'}
            onClick={() => void submitAnalysis()}
          >
            {analyzing ? 'Analyzing Call...' : `Run ${analysisMode} Live Analysis`}
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
