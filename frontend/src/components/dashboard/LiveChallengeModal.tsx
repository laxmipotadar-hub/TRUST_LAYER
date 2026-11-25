import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Mic,
  MicOff,
  Radio,
  ShieldAlert,
  Timer,
  Volume2,
} from 'lucide-react';
import { useAegis } from '../../hooks/useAegis';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { ActionButton } from '../ui/ActionButton';
import { AlertCard } from '../ui/AlertCard';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function LiveChallengeModal() {
  const {
    currentCall,
    activeChallenge,
    challengeResult,
    challengeModalOpen,
    closeChallengeModal,
    openChallengeForCurrentCall,
    verifyActiveChallenge,
  } = useAegis();

  const [secondsLeft, setSecondsLeft] = useState(12);
  const [listening, setListening] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [heardText, setHeardText] = useState('');
  const [micNote, setMicNote] = useState<string>('');
  const [typedProbe, setTypedProbe] = useState('');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(Date.now());

  const speechSupported = typeof window !== 'undefined' && getSpeechRecognitionCtor() !== null;

  const stopCapture = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  useEffect(() => {
    if (!challengeModalOpen || !activeChallenge) {
      stopCapture();
      return;
    }

    setSecondsLeft(activeChallenge.window_seconds);
    setHeardText('');
    setMicNote('');
    setTypedProbe('');
    startTimeRef.current = Date.now();

    if (challengeResult) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          stopCapture();
          void verifyActiveChallenge({
            spokenResponse: '',
            latencyMs: activeChallenge.window_seconds * 1000,
            captureMode: 'TIMEOUT',
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
      stopCapture();
    };
  }, [challengeModalOpen, activeChallenge, challengeResult, stopCapture, verifyActiveChallenge]);

  if (!activeChallenge) return null;

  const startLiveSpeechCapture = async () => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setMicNote(
        'Browser SpeechRecognition API is unsupported in this browser. Live speech cannot be verified; use the clearly labelled simulation controls below.',
      );
      return;
    }

    setMicNote('Listening for spoken nonce...');
    setListening(true);
    startTimeRef.current = Date.now();
    audioChunksRef.current = [];

    // Optional MediaRecorder audio capture for backend Aletheia/Eidos forwarding
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch {
        setMicNote('Microphone audio stream unavailable; using SpeechRecognition transcript only.');
      }
    }

    const recognition = new RecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      const elapsed = Math.max(250, Date.now() - startTimeRef.current);
      setHeardText(transcript);
      stopCapture();
      stream?.getTracks().forEach((t) => t.stop());

      setVerifying(true);
      const blob =
        audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
          : undefined;
      await verifyActiveChallenge({
        spokenResponse: transcript,
        latencyMs: elapsed,
        captureMode: blob ? 'LIVE_SPEECH_AUDIO' : 'LIVE_SPEECH_ONLY',
        audioBlob: blob,
      });
      setVerifying(false);
    };

    recognition.onerror = (err) => {
      stopCapture();
      stream?.getTracks().forEach((t) => t.stop());
      setMicNote(`Microphone / speech recognition error (${err.error}). Use simulation path if testing without mic.`);
    };

    recognition.onend = () => {
      setListening(false);
      stream?.getTracks().forEach((t) => t.stop());
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const runSimulationReplayFail = async () => {
    stopCapture();
    setVerifying(true);
    const replayTranscript = 'Yes, please confirm and process the beneficiary update now.';
    setHeardText(replayTranscript);
    await verifyActiveChallenge({
      spokenResponse: replayTranscript,
      latencyMs: 1600,
      captureMode: 'SIMULATED_REPLAY_FAIL',
    });
    setVerifying(false);
  };

  const runSimulationLivePass = async () => {
    stopCapture();
    setVerifying(true);
    setHeardText(activeChallenge.phrase);
    await verifyActiveChallenge({
      spokenResponse: activeChallenge.phrase,
      latencyMs: 1450,
      captureMode: 'SIMULATED_LIVE_PASS',
    });
    setVerifying(false);
  };

  const runTextProbeRejected = async () => {
    stopCapture();
    setVerifying(true);
    await verifyActiveChallenge({
      spokenResponse: typedProbe || activeChallenge.phrase,
      latencyMs: 1100,
      captureMode: 'TEXT_INPUT',
    });
    setVerifying(false);
  };

  return (
    <Modal
      open={challengeModalOpen}
      onClose={closeChallengeModal}
      title="LIVE IDENTITY CHALLENGE"
      subtitle={`Dynamic Anti-Replay Liveness Verification · ${activeChallenge.challenge_id}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Phrase Prompt Box */}
        <div className="rounded-xl border border-sky-500/35 bg-[#0a0f1e] p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-[#94a3b8]">
            <Volume2 className="h-4 w-4 text-sky-400" />
            Please repeat the following phrase.
          </div>

          <div className="mt-3 font-mono text-2xl font-bold tracking-wide text-[#f8fafc] sm:text-3xl">
            &ldquo;Repeat: {activeChallenge.phrase}.&rdquo;
          </div>

          {/* Mic status, Countdown, Recording animation */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <StatusBadge
              label={
                listening
                  ? 'MIC LISTENING'
                  : speechSupported
                    ? 'SPEECH API READY'
                    : 'SPEECH API UNSUPPORTED'
              }
              tone={listening ? 'safe' : speechSupported ? 'info' : 'caution'}
              dot
              pulse={listening}
              icon={listening ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            />

            <StatusBadge
              label={`WINDOW: ${secondsLeft}s`}
              tone={secondsLeft <= 4 ? 'threat' : 'neutral'}
              icon={<Timer className="h-3 w-3" />}
            />

            <ProvenanceBadge provenance={activeChallenge.provenance} compact />
          </div>

          {listening && (
            <div className="mt-4 flex items-center justify-center gap-1.5" aria-label="Recording in progress">
              {[18, 30, 22, 34, 26, 16, 28].map((h, i) => (
                <span
                  key={i}
                  className="w-1.5 animate-pulse rounded-full bg-[#22c55e]"
                  style={{ height: `${h}px`, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* S3 Context Callout */}
        {currentCall?.scenario_id === 'S3' && !challengeResult && (
          <AlertCard
            tone="caution"
            title="S3 Replay Scenario Active (Score-Based Verdict: 95.05 SAFE)"
            description="Aletheia saw 96% human vocal origin and Eidos matched Marcus Vance at 94%. Click 'Simulate Replay Attack (S3)' below to demonstrate why a pre-recorded voice fails an unpredictable challenge."
          />
        )}

        {micNote && (
          <p className="rounded border border-slate-800 bg-[#151e30] px-3 py-2 text-xs text-[#94a3b8]">
            {micNote}
          </p>
        )}

        {heardText && (
          <div className="rounded-lg border border-slate-800 bg-[#151e30] px-3.5 py-2.5 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
              Captured Response:
            </span>
            <div className="mt-1 font-mono text-[#f8fafc]">&ldquo;{heardText}&rdquo;</div>
          </div>
        )}

        {/* Controls */}
        {!challengeResult && (
          <div className="space-y-3 rounded-lg border border-slate-800 bg-[#151e30]/70 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                variant="primary"
                size="md"
                loading={verifying}
                disabled={listening}
                icon={<Mic className="h-3.5 w-3.5" />}
                onClick={() => void startLiveSpeechCapture()}
              >
                {listening ? 'Listening...' : 'Start Live Microphone Challenge'}
              </ActionButton>

              <ActionButton
                variant="threat"
                size="md"
                loading={verifying}
                icon={<Radio className="h-3.5 w-3.5" />}
                onClick={() => void runSimulationReplayFail()}
              >
                Simulate Replay Attack (S3 Fail)
              </ActionButton>

              <ActionButton
                variant="safe"
                size="md"
                loading={verifying}
                onClick={() => void runSimulationLivePass()}
              >
                Simulate Live Pass (SIMULATION)
              </ActionButton>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-800 pt-2.5">
              <input
                type="text"
                placeholder="Type phrase (verified rejected as non-live proof)..."
                value={typedProbe}
                onChange={(e) => setTypedProbe(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-700 bg-[#0a0f1e] px-2.5 py-1.5 text-xs text-[#f8fafc]"
              />
              <ActionButton
                variant="secondary"
                disabled={verifying}
                onClick={() => void runTextProbeRejected()}
              >
                Test Typed Text Rejection
              </ActionButton>
            </div>
          </div>
        )}

        {/* Verification Progress & Result */}
        {challengeResult && (
          <div className="space-y-3">
            <div
              className={`rounded-xl border p-4 ${
                challengeResult.passed
                  ? 'border-[#22c55e]/40 bg-[#22c55e]/10'
                  : 'animate-threat-escalation border-[#ef4444]/50 bg-[#ef4444]/12'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {challengeResult.passed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#22c55e]" />
                  ) : (
                    <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-[#ef4444]" />
                  )}
                  <div className="space-y-0.5">
                    {challengeResult.banner_lines.map((line, i) => (
                      <div
                        key={i}
                        className={`font-mono text-sm font-bold tracking-wider ${
                          challengeResult.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
                <ProvenanceBadge provenance={challengeResult.provenance} compact />
              </div>

              <p className="mt-2.5 text-xs leading-relaxed text-[#f8fafc]">
                {challengeResult.explanation}
              </p>
            </div>

            {/* 5 Verification Checks Breakdown */}
            <div className="space-y-1.5 rounded-lg border border-slate-800 bg-[#151e30] p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                <ShieldAlert className="h-3.5 w-3.5 text-sky-400" />
                5-Point Liveness Verification Pipeline
              </div>
              {challengeResult.checks.map((chk) => (
                <div
                  key={chk.key}
                  className="flex items-start justify-between gap-3 rounded border border-slate-800/80 bg-[#0a0f1e]/60 px-2.5 py-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-[#f8fafc]">{chk.label}</div>
                    <div className="text-[11px] text-[#94a3b8]">{chk.detail}</div>
                  </div>
                  <StatusBadge
                    label={chk.passed ? 'PASS' : 'FAIL'}
                    tone={chk.passed ? 'safe' : 'threat'}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <ActionButton
                variant="secondary"
                onClick={() => void openChallengeForCurrentCall()}
              >
                Issue New Unpredictable Phrase
              </ActionButton>
              <ActionButton variant="primary" onClick={closeChallengeModal}>
                Return to Dashboard
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
