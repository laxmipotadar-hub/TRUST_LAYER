import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mic,
  StopCircle,
  Radio,
  ShieldCheck,
  UserCheck,
  FileSearch,
  Activity,
  Scale,
  FileText,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Coins,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Banner";
import { ModeBadge } from "../components/ui/ModeBadge";
import { ChallengeModal } from "../features/challenge/ChallengeModal";
import { useAnalysis } from "../context/AnalysisContext";
import { aegisApi, LiveCallSocketClient } from "../lib/api";
import {
  AudioCaptureHelper,
  concatWavSamplesTo16kBlob,
  int16ToBase64,
  startAudioWorkletCapture,
  type AudioRecordingResult,
  type LiveWorkletController,
} from "../lib/audio";
import type {
  CallReportResponse,
  CallSession,
  CreditsResponse,
  UsageSummaryResponse,
  VoiceprintRecord,
  VoiceprintVerifyResponse,
} from "../types";

const STEP_LABELS = [
  "1. Connect",
  "2. Enroll",
  "3. Live Aletheia",
  "4. Live Eidos",
  "5. Script Analysis",
  "6. Manipulation",
  "7. Fusion & Action",
  "8. Report & Usage",
];

const TELEPROMPTER_SCRIPT =
  "Hello, this is the senior fraud security team calling urgently about suspicious transfers on your account. Do not hang up or tell anyone at the branch — read back your 6-digit OTP verification code immediately or your account will be frozen within ten minutes under regulatory warrant.";

export const LiveDemoPage: React.FC = () => {
  const {
    executionMode,
    setExecutionMode,
    health,
    refreshSystem,
    refreshVoiceprints,
    applyUpdatedCall,
    executeCallAction,
  } = useAnalysis();

  const [stepIndex, setStepIndex] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1: Connect & Mic Check
  const [micReady, setMicReady] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const micProbeRef = useRef<AudioCaptureHelper | null>(null);
  const [probingMic, setProbingMic] = useState(false);

  // Step 2: Enroll 3 Samples
  const [presenterName, setPresenterName] = useState("Live Presenter");
  const [presenterId, setPresenterId] = useState("CUST-LIVE-PRESENTER");
  const [samples, setSamples] = useState<AudioRecordingResult[]>([]);
  const [recordingSample, setRecordingSample] = useState(false);
  const sampleRecRef = useRef<AudioCaptureHelper | null>(null);
  const [enrolledVp, setEnrolledVp] = useState<VoiceprintRecord | null>(null);

  // Step 3: Live Aletheia WS + Waveform
  const wsClientRef = useRef<LiveCallSocketClient | null>(null);
  const workletCtrlRef = useRef<LiveWorkletController | null>(null);
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("disconnected");
  const [streamingAudio, setStreamingAudio] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(new Array(24).fill(4));
  const [wsChunksSent, setWsChunksSent] = useState(0);
  const [liveAletheiaCall, setLiveAletheiaCall] = useState<CallSession | null>(null);
  const [latestLiveBlob, setLatestLiveBlob] = useState<Blob | null>(null);

  // Step 4: Live Eidos (Own vs Impostor)
  const [eidosRecordingTarget, setEidosRecordingTarget] = useState<"own" | "impostor" | null>(
    null
  );
  const eidosRecRef = useRef<AudioCaptureHelper | null>(null);
  const [ownVerifyResult, setOwnVerifyResult] = useState<VoiceprintVerifyResponse | null>(null);
  const [impostorVerifyResult, setImpostorVerifyResult] =
    useState<VoiceprintVerifyResponse | null>(null);

  // Step 5: Script Analysis + Browser STT
  const [spokenTranscript, setSpokenTranscript] = useState(TELEPROMPTER_SCRIPT);
  const [sttListening, setSttListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [scriptCall, setScriptCall] = useState<CallSession | null>(null);

  // Step 6: Manipulation Streaming
  const [manipTranscript, setManipTranscript] = useState(
    "You must keep this confidential right now. Do not contact your branch. Read the code immediately before authorities suspend your account."
  );
  const [liveManipMarkers, setLiveManipMarkers] = useState<
    Array<{ category: string; phrase: string; severity: string }>
  >([]);
  const [manipScore, setManipScore] = useState<number | null>(null);
  const [manipStreaming, setManipStreaming] = useState(false);
  const manipWsRef = useRef<LiveCallSocketClient | null>(null);
  const manipWorkletRef = useRef<LiveWorkletController | null>(null);

  // Step 7: Fusion & Challenge / Bot Guard Action
  const [fusionCall, setFusionCall] = useState<CallSession | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [actionDoneNote, setActionDoneNote] = useState<string | null>(null);

  // Step 8: Report & Usage
  const [finalReport, setFinalReport] = useState<CallReportResponse | null>(null);
  const [usageSummary, setUsageSummary] = useState<UsageSummaryResponse | null>(null);

  useEffect(() => {
    setExecutionMode("LIVE");
    return () => {
      micProbeRef.current?.cancel();
      sampleRecRef.current?.cancel();
      eidosRecRef.current?.cancel();
      wsClientRef.current?.disconnect();
      manipWsRef.current?.disconnect();
      workletCtrlRef.current?.stop().catch(() => {});
      manipWorkletRef.current?.stop().catch(() => {});
      recognitionRef.current?.stop();
    };
  }, [setExecutionMode]);

  // Step 1 Actions
  const handleConnectCheck = async () => {
    setGlobalError(null);
    setBusy(true);
    setExecutionMode("LIVE");
    try {
      await refreshSystem();
      const cred = await aegisApi.getCredits();
      setCredits(cred);
      if (cred.error && cred.error.toLowerCase().includes("402")) {
        setGlobalError("DetectifAI credit quota exhausted (402). Top up before running LIVE analysis.");
      }
    } catch (err: unknown) {
      setGlobalError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Backend connection check failed."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMicProbe = async () => {
    setGlobalError(null);
    if (probingMic) {
      setProbingMic(false);
      await micProbeRef.current?.stop().catch(() => {});
      setMicLevel(0);
      return;
    }
    try {
      const helper = new AudioCaptureHelper();
      micProbeRef.current = helper;
      setProbingMic(true);
      await helper.start((lvl) => {
        setMicLevel(lvl);
        if (lvl > 3) setMicReady(true);
      });
      setMicReady(true);
    } catch {
      setProbingMic(false);
      setGlobalError("Microphone permission denied or no audio input device available.");
    }
  };

  // Step 2 Actions
  const handleRecordSample = async () => {
    setGlobalError(null);
    if (recordingSample) {
      setRecordingSample(false);
      const res = await sampleRecRef.current?.stop().catch(() => null);
      if (res) {
        if (res.quality.silenceRatio > 0.92) {
          setGlobalError("Sample rejected: audio appeared mostly silent. Speak clearly into microphone.");
          return;
        }
        setSamples((prev) => [...prev, res]);
      }
      return;
    }
    try {
      const helper = new AudioCaptureHelper();
      sampleRecRef.current = helper;
      setRecordingSample(true);
      await helper.start((lvl) => setMicLevel(lvl));
    } catch {
      setRecordingSample(false);
      setGlobalError("Unable to access microphone for enrollment sample.");
    }
  };

  const handleEnrollSamples = async () => {
    if (samples.length === 0) return;
    setBusy(true);
    setGlobalError(null);
    try {
      const mergedBlob = concatWavSamplesTo16kBlob(samples.map((s) => s.pcm16));
      const totalDuration = samples.reduce((sum, s) => sum + s.durationSeconds, 0);
      const vp = await aegisApi.enrollVoiceprintAudio({
        file: mergedBlob,
        customer_id: presenterId.trim() || "CUST-LIVE-PRESENTER",
        customer_name: presenterName.trim() || "Live Presenter",
        consent_confirmed: true,
        sample_duration_sec: Math.max(5, Number(totalDuration.toFixed(1))),
      });
      setEnrolledVp(vp);
      await refreshVoiceprints();
    } catch (err: unknown) {
      setGlobalError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Voiceprint enrollment failed."
      );
    } finally {
      setBusy(false);
    }
  };

  // Step 3 Actions (WS 16 kHz PCM Stream + Finalize Live Aletheia)
  const handleStartAletheiaStream = async () => {
    setGlobalError(null);
    setWsChunksSent(0);
    setLiveAletheiaCall(null);

    const client = new LiveCallSocketClient({
      onStatus: (st) => setWsStatus(st),
      onError: (msg) => setGlobalError(msg),
      onMessage: (payload) => {
        if (payload.type === "finalized" && payload.session) {
          const sess = payload.session as CallSession;
          setLiveAletheiaCall(sess);
          setFusionCall(sess);
          applyUpdatedCall(sess);
          setBusy(false);
        } else if (payload.type === "error") {
          setGlobalError(String(payload.message || "WebSocket streaming error"));
          setBusy(false);
        }
      },
    });
    wsClientRef.current = client;
    client.connect();

    try {
      const ctrl = await startAudioWorkletCapture({
        onLevel: (lvl) => setMicLevel(lvl),
        onChunk: (pcm, _lvl, bars) => {
          if (bars.length > 0) setWaveform(bars);
          client.sendJson({
            type: "audio_chunk",
            pcm16_base64: int16ToBase64(pcm),
            sample_rate: 16000,
          });
          setWsChunksSent((n) => n + 1);
        },
      });
      workletCtrlRef.current = ctrl;
      setStreamingAudio(true);
    } catch {
      client.disconnect();
      setGlobalError("Microphone denied while initializing 16 kHz AudioWorklet stream.");
    }
  };

  const handleStopAletheiaStream = async () => {
    setStreamingAudio(false);
    setBusy(true);
    try {
      const ctrl = workletCtrlRef.current;
      workletCtrlRef.current = null;
      if (ctrl) {
        const res = await ctrl.stop();
        setLatestLiveBlob(res.blob);
      }
      wsClientRef.current?.sendJson({
        type: "finalize",
        claimed_customer_id: enrolledVp?.customer_id || presenterId,
        caller_label: `${presenterName} (Live WS)`,
        transcript_text: spokenTranscript,
        execution_mode: "LIVE",
      });
    } catch (err: unknown) {
      setBusy(false);
      setGlobalError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to finalize live Aletheia analysis."
      );
    }
  };

  // Step 4 Actions (Own vs Impostor Eidos Verification)
  const handleToggleEidosSample = async (target: "own" | "impostor") => {
    setGlobalError(null);
    if (eidosRecordingTarget === target) {
      setEidosRecordingTarget(null);
      setBusy(true);
      try {
        const res = await eidosRecRef.current?.stop();
        if (res) {
          const verified = await aegisApi.verifyVoiceprint({
            file: res.blob,
            claimed_customer_id: enrolledVp?.customer_id || presenterId,
            simulate_outcome: target === "own" ? "match" : "mismatch",
          });
          if (target === "own") setOwnVerifyResult(verified);
          else setImpostorVerifyResult(verified);
        }
      } catch (err: unknown) {
        setGlobalError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Speaker verification call failed."
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const helper = new AudioCaptureHelper();
      eidosRecRef.current = helper;
      setEidosRecordingTarget(target);
      await helper.start((lvl) => setMicLevel(lvl));
    } catch {
      setEidosRecordingTarget(null);
      setGlobalError("Microphone permission denied.");
    }
  };

  // Step 5 Actions (SpeechRecognition + Live Script Analysis)
  const handleToggleBrowserStt = () => {
    if (sttListening) {
      recognitionRef.current?.stop();
      setSttListening(false);
      return;
    }
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SpeechRec) {
      setGlobalError("Browser SpeechRecognition unavailable — edit the teleprompter transcript directly below.");
      return;
    }
    const rec = new SpeechRec() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (evt) => {
      const joined = Array.from(evt.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (joined) setSpokenTranscript(joined);
    };
    rec.onerror = () => setSttListening(false);
    rec.onend = () => setSttListening(false);
    rec.start();
    recognitionRef.current = rec;
    setSttListening(true);
  };

  const handleRunScriptAnalysis = async () => {
    setBusy(true);
    setGlobalError(null);
    try {
      const res = await aegisApi.analyzeCall({
        file: latestLiveBlob || undefined,
        transcript_text: spokenTranscript,
        claimed_customer_id: enrolledVp?.customer_id || presenterId,
        caller_label: `${presenterName} (Script Check)`,
        execution_mode: "LIVE",
      });
      setScriptCall(res.session);
      setFusionCall(res.session);
      applyUpdatedCall(res.session);
    } catch (err: unknown) {
      setGlobalError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Live Script Analysis failed."
      );
    } finally {
      setBusy(false);
    }
  };

  // Step 6 Actions (Real-time Manipulation Telemetry over WS)
  const handleToggleManipStream = async () => {
    setGlobalError(null);
    if (manipStreaming) {
      setManipStreaming(false);
      await manipWorkletRef.current?.stop().catch(() => {});
      manipWsRef.current?.sendJson({
        type: "transcript_chunk",
        text: manipTranscript,
      });
      manipWsRef.current?.sendJson({
        type: "finalize",
        claimed_customer_id: enrolledVp?.customer_id || presenterId,
        caller_label: `${presenterName} (Manipulation Stream)`,
        transcript_text: manipTranscript,
        execution_mode: "LIVE",
      });
      return;
    }

    const client = new LiveCallSocketClient({
      onStatus: (st) => setWsStatus(st),
      onError: (msg) => setGlobalError(msg),
      onMessage: (payload) => {
        if (payload.type === "partial_update") {
          const markers = (payload.markers || []) as Array<{
            category: string;
            phrase: string;
            severity: string;
          }>;
          setLiveManipMarkers(markers);
          if (typeof payload.manipulation_score === "number") {
            setManipScore(payload.manipulation_score);
          }
        } else if (payload.type === "finalized" && payload.session) {
          const sess = payload.session as CallSession;
          setFusionCall(sess);
          applyUpdatedCall(sess);
        }
      },
    });
    manipWsRef.current = client;
    client.connect();

    try {
      const ctrl = await startAudioWorkletCapture({
        onLevel: (lvl) => setMicLevel(lvl),
        onChunk: (pcm, _lvl, bars) => {
          if (bars.length > 0) setWaveform(bars);
          client.sendJson({
            type: "audio_chunk",
            pcm16_base64: int16ToBase64(pcm),
            sample_rate: 16000,
          });
          client.sendJson({
            type: "transcript_chunk",
            text: manipTranscript,
          });
        },
      });
      manipWorkletRef.current = ctrl;
      setManipStreaming(true);
    } catch {
      client.disconnect();
      setGlobalError("Microphone unavailable for Manipulation WS step.");
    }
  };

  // Step 8 Load Report & Usage
  const handleLoadReportAndUsage = async () => {
    setBusy(true);
    setGlobalError(null);
    try {
      const targetCallId = fusionCall?.call_id || scriptCall?.call_id || liveAletheiaCall?.call_id;
      const [repList, usage] = await Promise.all([
        targetCallId ? aegisApi.getCallReport(targetCallId) : Promise.resolve(null),
        aegisApi.getUsage(true),
      ]);
      if (repList) setFinalReport(repList);
      setUsageSummary(usage);
    } catch (err: unknown) {
      setGlobalError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to load report & usage ledger."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (stepIndex === 7) {
      void handleLoadReportAndUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const activeFusion = fusionCall || scriptCall || liveAletheiaCall;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">AEGIS Live Microphone Presentation Demo</h1>
          <p className="body-text">
            Sequential 8-step LIVE analysis against real DetectifAI Aletheia + Eidos APIs — zero
            cache, zero synthetic mocks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeBadge mode="LIVE" />
          <Badge variant={wsStatus === "connected" ? "success" : "neutral"}>
            {wsStatus === "connected" ? (
              <span className="inline-flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> WS {wsStatus}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" /> WS {wsStatus}
              </span>
            )}
          </Badge>
        </div>
      </div>

      {/* Stepper */}
      <Card className="!p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {STEP_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => setStepIndex(idx)}
              className={`px-2.5 py-2 rounded-lg text-[13px] font-semibold text-left border cursor-pointer transition-colors ${
                idx === stepIndex
                  ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                  : idx < stepIndex
                    ? "bg-[var(--decision-continue-tint)] text-[var(--decision-continue-text)] border-[var(--decision-continue-border)]"
                    : "bg-[var(--fill-subtle)] text-[var(--text-secondary)] border-[var(--border)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {executionMode !== "LIVE" && (
        <Banner variant="warn" title="LIVE Mode Enforced">
          Live Demo forces LIVE mode and bypasses all local caches so every provider row is recorded
          as FRESH.
        </Banner>
      )}

      {globalError && (
        <Banner variant="error" title="Live Demo Error">
          {globalError}
        </Banner>
      )}

      {/* Step Content */}
      {stepIndex === 0 && (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Step 1: Connect Mic, Verify Health &amp; Check Credits</h2>
            <Badge variant={micReady ? "success" : "warning"}>
              {micReady ? "Mic Ready" : "Check Mic"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-1">
              <div className="caption-text font-semibold">DetectifAI API Key</div>
              <div className="text-[18px] font-bold">
                {health?.detectifai_configured ? "CONFIGURED (LIVE)" : "NOT SET"}
              </div>
              {!health?.detectifai_configured && (
                <Link to="/settings" className="text-[13px] text-[var(--brand-steel)] underline">
                  Configure in Settings &rarr;
                </Link>
              )}
            </div>
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-1">
              <div className="caption-text font-semibold">DetectifAI Credit Balance</div>
              <div className="text-[18px] font-bold font-mono flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[var(--brand-steel)]" />
                {credits?.available !== null && credits?.available !== undefined
                  ? credits.available
                  : "Click Check Health"}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
              <div className="caption-text font-semibold">Live Input Level ({micLevel}%)</div>
              <div className="w-full h-3 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--decision-continue-solid)] transition-all duration-75"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={handleConnectCheck}
              icon={<RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />}
            >
              Verify Backend Health &amp; Credits
            </Button>
            <Button
              type="button"
              variant={probingMic ? "danger" : "secondary"}
              onClick={handleToggleMicProbe}
              icon={<Mic className="w-4 h-4" />}
            >
              {probingMic ? "Stop Mic Meter" : "Test Live Microphone"}
            </Button>
          </div>
        </Card>
      )}

      {stepIndex === 1 && (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Step 2: Enroll Presenter Voiceprint (Eidos)</h2>
            <Badge variant={enrolledVp ? "success" : "neutral"}>
              {samples.length} Sample(s) Recorded
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Presenter Name</span>
              <input
                type="text"
                value={presenterName}
                onChange={(e) => setPresenterName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Customer ID</span>
              <input
                type="text"
                value={presenterId}
                onChange={(e) => setPresenterId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono"
              />
            </label>
          </div>

          <p className="body-text">
            Record 3 short voice samples (~7 s each) speaking naturally, then upload the concatenated
            16 kHz WAV to Eidos enrollment.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={recordingSample ? "danger" : "secondary"}
              onClick={handleRecordSample}
              icon={recordingSample ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            >
              {recordingSample
                ? `Stop Sample #${samples.length + 1}`
                : `Record Sample #${samples.length + 1}`}
            </Button>

            <Button
              type="button"
              variant="primary"
              disabled={busy || samples.length === 0}
              onClick={handleEnrollSamples}
              icon={<UserCheck className="w-4 h-4" />}
            >
              {busy ? "Enrolling..." : `Enroll Voiceprint (${samples.length} sample/s)`}
            </Button>
          </div>

          {samples.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {samples.map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] space-y-1"
                >
                  <div className="font-semibold text-[13px]">
                    Sample #{idx + 1} ({s.durationSeconds.toFixed(1)}s)
                  </div>
                  <audio controls src={s.url} className="w-full h-8" />
                </div>
              ))}
            </div>
          )}

          {enrolledVp && (
            <Banner variant="info" title="Voiceprint Enrolled">
              Enrolled {enrolledVp.customer_name} (`{enrolledVp.voiceprint_id}`) &bull; Speaker ref:{" "}
              {enrolledVp.provider_speaker_ref || "Active baseline"}.
            </Banner>
          )}
        </Card>
      )}

      {stepIndex === 2 && (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Step 3: Live Aletheia Deepfake Stream (16 kHz WebSocket)</h2>
            <Badge variant={streamingAudio ? "warning" : "neutral"}>
              Chunks Sent: {wsChunksSent}
            </Badge>
          </div>

          {/* 24-bar Live Waveform SVG */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)]">
            <svg viewBox="0 0 240 60" className="w-full h-20">
              {waveform.map((val, idx) => {
                const h = Math.max(4, (val / 100) * 52);
                return (
                  <rect
                    key={idx}
                    x={idx * 10 + 1}
                    y={30 - h / 2}
                    width="7"
                    height={h}
                    rx="2"
                    fill={streamingAudio ? "var(--brand-steel)" : "var(--border)"}
                  />
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap gap-3">
            {!streamingAudio ? (
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={handleStartAletheiaStream}
                icon={<Radio className="w-4 h-4" />}
              >
                Start 16 kHz WS Audio Stream (Speak 8+ seconds)
              </Button>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={handleStopAletheiaStream}
                icon={<StopCircle className="w-4 h-4" />}
              >
                Stop &amp; Run Live Aletheia
              </Button>
            )}
          </div>

          {liveAletheiaCall && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[15px]">
                  Aletheia Status: {liveAletheiaCall.voice_authenticity.status}
                </span>
                <span className="font-mono font-bold text-[16px]">
                  Synthetic Likelihood:{" "}
                  {liveAletheiaCall.voice_authenticity.deepfake_probability !== null
                    ? liveAletheiaCall.voice_authenticity.deepfake_probability.toFixed(3)
                    : "N/A"}
                </span>
              </div>
              <p className="caption-text">
                Operation ID: {liveAletheiaCall.voice_authenticity.operation_id || "—"} &bull;
                Latency: {liveAletheiaCall.voice_authenticity.latency_ms ?? "—"} ms &bull; Cache hit:{" "}
                {String(liveAletheiaCall.voice_authenticity.cache_hit)}
              </p>
            </div>
          )}
        </Card>
      )}

      {stepIndex === 3 && (
        <Card className="space-y-5">
          <h2 className="section-title">Step 4: Live Eidos Biometric Verification (Own vs Other Speaker)</h2>
          <p className="body-text">
            Test against enrolled customer `{enrolledVp?.customer_id || presenterId}`. First speak
            yourself to observe VERIFIED; then let someone else speak (or alter voice) to observe
            MISMATCH.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-3">
              <h3 className="font-bold text-[15px]">4A. Presenter Own Voice</h3>
              <Button
                type="button"
                variant={eidosRecordingTarget === "own" ? "danger" : "primary"}
                disabled={busy || eidosRecordingTarget === "impostor"}
                onClick={() => void handleToggleEidosSample("own")}
                icon={<Mic className="w-4 h-4" />}
              >
                {eidosRecordingTarget === "own" ? "Stop & Verify Own Voice" : "Record Own Voice Sample"}
              </Button>
              {ownVerifyResult && (
                <div className="space-y-1">
                  <Badge variant={ownVerifyResult.verification_result === "VERIFIED" ? "success" : "warning"}>
                    {ownVerifyResult.verification_result} ({ownVerifyResult.match_percentage?.toFixed(1) ?? "—"}%)
                  </Badge>
                  <p className="caption-text">{ownVerifyResult.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-3">
              <h3 className="font-bold text-[15px]">4B. Different Speaker / Impostor</h3>
              <Button
                type="button"
                variant={eidosRecordingTarget === "impostor" ? "danger" : "secondary"}
                disabled={busy || eidosRecordingTarget === "own"}
                onClick={() => void handleToggleEidosSample("impostor")}
                icon={<Mic className="w-4 h-4" />}
              >
                {eidosRecordingTarget === "impostor"
                  ? "Stop & Verify Impostor"
                  : "Record Different Speaker Sample"}
              </Button>
              {impostorVerifyResult && (
                <div className="space-y-1">
                  <Badge variant={impostorVerifyResult.verification_result === "MISMATCH" ? "danger" : "warning"}>
                    {impostorVerifyResult.verification_result} ({impostorVerifyResult.match_percentage?.toFixed(1) ?? "—"}%)
                  </Badge>
                  <p className="caption-text">{impostorVerifyResult.notes}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {stepIndex === 4 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Step 5: Script Analysis Teleprompter &amp; Live ASR</h2>
            <Badge variant="info">Layer 3</Badge>
          </div>

          <div className="p-4 rounded-xl border border-[var(--brand-steel)] bg-[var(--fill-subtle)] space-y-2">
            <div className="text-[12px] font-bold uppercase text-[var(--brand-steel)]">
              Teleprompter Prompt
            </div>
            <p className="text-[16px] font-medium text-[var(--text-primary)]">{TELEPROMPTER_SCRIPT}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={sttListening ? "danger" : "secondary"}
              onClick={handleToggleBrowserStt}
              icon={<Mic className="w-4 h-4" />}
            >
              {sttListening ? "Stop Speech-to-Text" : "Capture Live Speech-to-Text"}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={handleRunScriptAnalysis}
              icon={<FileSearch className="w-4 h-4" />}
            >
              {busy ? "Analyzing Script..." : "Run Live Script Analysis"}
            </Button>
          </div>

          <textarea
            value={spokenTranscript}
            onChange={(e) => setSpokenTranscript(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
          />

          {scriptCall && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">Engine: {scriptCall.scam_analysis.engine_used}</span>
                <Badge
                  variant={
                    scriptCall.scam_analysis.risk_score === null
                      ? "neutral"
                      : scriptCall.scam_analysis.risk_score >= 60
                        ? "danger"
                        : "warning"
                  }
                >
                  Script Risk:{" "}
                  {scriptCall.scam_analysis.risk_score !== null
                    ? `${scriptCall.scam_analysis.risk_score.toFixed(1)}/100`
                    : "Unavailable"}
                </Badge>
              </div>
              <p className="body-text">{scriptCall.scam_analysis.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {scriptCall.scam_analysis.categories.map((c) => (
                  <Badge key={c} variant="danger">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {stepIndex === 5 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Step 6: Real-Time Manipulation &amp; Pressure Markers</h2>
            <Badge variant="info">Layer 4</Badge>
          </div>

          <textarea
            value={manipTranscript}
            onChange={(e) => setManipTranscript(e.target.value)}
            rows={2}
            className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
          />

          <Button
            type="button"
            variant={manipStreaming ? "danger" : "primary"}
            onClick={() => void handleToggleManipStream()}
            icon={<Activity className="w-4 h-4" />}
          >
            {manipStreaming
              ? "Stop Stream & Finalize Manipulation Telemetry"
              : "Stream Coercive Audio + Markers over WS"}
          </Button>

          {manipScore !== null && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
              <div className="font-bold text-[15px]">
                Live Pressure Score: {manipScore.toFixed(1)}/100 ({liveManipMarkers.length} markers)
              </div>
              <div className="flex flex-wrap gap-2">
                {liveManipMarkers.map((m, idx) => (
                  <Badge key={idx} variant={m.severity === "HIGH" ? "danger" : "warning"}>
                    {m.category}: &ldquo;{m.phrase}&rdquo;
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {stepIndex === 6 && (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Step 7: 4-Layer Composite Fusion, Overrides &amp; Action</h2>
            <Scale className="w-5 h-5 text-[var(--brand-steel)]" />
          </div>

          {!activeFusion ? (
            <Banner variant="warn" title="Run Earlier Live Steps First">
              Complete Step 3, 5, or 6 so AEGIS has a real LIVE CallSession to inspect here.
            </Banner>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)]">
                  <div className="caption-text font-semibold">Composite Trust Score</div>
                  <div className="text-[28px] font-bold font-mono">
                    {activeFusion.trust_score?.toFixed(1) ?? "N/A"}/100
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)]">
                  <div className="caption-text font-semibold">Fusion Band / Decision</div>
                  <div className="text-[22px] font-bold">
                    {activeFusion.band} &rarr; {activeFusion.decision}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)]">
                  <div className="caption-text font-semibold">Voice-Clone / Liveness Override</div>
                  <div className="text-[16px] font-semibold">
                    {activeFusion.trust_breakdown.voice_clone_override_applied
                      ? "Voice-Clone Override Active"
                      : activeFusion.trust_breakdown.liveness_override_applied
                        ? "Liveness Override Active"
                        : "None Triggered"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setChallengeOpen(true)}
                  icon={<ShieldCheck className="w-4 h-4" />}
                >
                  Trigger STEP_UP Liveness Challenge
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await executeCallAction("PAUSE_BOT", "Paused during live presentation");
                    setActionDoneNote("Executed PAUSE_BOT on backend call session.");
                  }}
                >
                  Pause Voice Bot (`PAUSE_BOT`)
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    await executeCallAction("BLOCK", "Blocked in live demo");
                    setActionDoneNote("Executed BLOCK on backend call session.");
                  }}
                >
                  Block Call (`BLOCK`)
                </Button>
              </div>
              {actionDoneNote && (
                <Banner variant="info" title="Action Recorded">
                  {actionDoneNote}
                </Banner>
              )}
            </>
          )}

          <ChallengeModal
            isOpen={challengeOpen}
            onClose={() => setChallengeOpen(false)}
            callId={activeFusion?.call_id || undefined}
            customerId={enrolledVp?.customer_id || presenterId}
            executionMode="LIVE"
            onComplete={(resp, updated) => {
              if (updated) {
                setFusionCall(updated);
                applyUpdatedCall(updated);
              }
              setActionDoneNote(`Liveness Challenge: ${resp.liveness_status} — ${resp.explanation}`);
            }}
          />
        </Card>
      )}

      {stepIndex === 7 && (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Step 8: Backend Audit Report &amp; FRESH Usage Receipt</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleLoadReportAndUsage()}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh Receipt
            </Button>
          </div>

          {finalReport && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {finalReport.report_id} &bull; {finalReport.call_id}
                </span>
                <Link
                  to={`/reports/${encodeURIComponent(finalReport.call_id)}`}
                  className="text-[14px] font-semibold text-[var(--brand-steel)] hover:underline inline-flex items-center gap-1"
                >
                  <FileText className="w-4 h-4" /> Open Full Report
                </Link>
              </div>
              <p className="body-text">{finalReport.executive_summary}</p>
            </div>
          )}

          {usageSummary && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-[14px]">
                <span className="font-semibold">
                  Fresh Provider Calls: {usageSummary.fresh_calls}
                </span>
                <span className="font-semibold">
                  Credits Used: {usageSummary.total_credits_used}
                </span>
                <span className="font-semibold">
                  Remaining Balance: {usageSummary.credit_balance ?? "N/A"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                      <th className="py-2 pr-3">Service</th>
                      <th className="py-2 pr-3">Operation ID</th>
                      <th className="py-2 pr-3">Mode</th>
                      <th className="py-2 pr-3">Credits</th>
                      <th className="py-2 pr-3">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {usageSummary.operations.slice(0, 8).map((op) => (
                      <tr key={op.operation_id}>
                        <td className="py-2 pr-3 font-semibold uppercase">{op.service}</td>
                        <td className="py-2 pr-3 font-mono">{op.operation_id}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={op.mode === "FRESH" ? "success" : "neutral"}>
                            {op.mode}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 font-mono">{op.cost_credits}</td>
                        <td className="py-2 pr-3 font-mono">{op.latency_ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Previous Step
        </Button>

        {stepIndex < STEP_LABELS.length - 1 ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => setStepIndex((i) => Math.min(STEP_LABELS.length - 1, i + 1))}
          >
            <span className="inline-flex items-center gap-1.5">
              Next Step <ArrowRight className="w-4 h-4" />
            </span>
          </Button>
        ) : (
          <Link to="/usage">
            <Button type="button" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>
              Inspect Full Usage Ledger
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};
