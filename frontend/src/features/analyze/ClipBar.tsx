import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Upload, FileAudio, StopCircle, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Banner } from "../../components/ui/Banner";
import { copy } from "../../copy";
import { DEMO_SCENARIO_LIST } from "../../mocks/fixtures";
import { AudioCaptureHelper, transcodeBlobToWav16k } from "../../lib/audio";
import { formatDuration } from "../../lib/format";
import type { ExecutionMode, VoiceprintRecord } from "../../types";

export interface ClipBarProps {
  executionMode: ExecutionMode;
  activeScenarioId: string | null;
  voiceprints: VoiceprintRecord[];
  selectedCustomerId: string;
  onSelectCustomerId: (customerId: string) => void;
  isLoading: boolean;
  onSelectScenario: (id: "S1" | "S2" | "S3" | "S4") => void;
  onClearSession?: () => void;
  onAudioLevelChange?: (level: number) => void;
  onAnalyzeAudio: (params: {
    file?: Blob;
    filename?: string;
    transcript_text: string;
    claimed_customer_id: string;
    caller_label?: string;
    duration_hint_sec?: number;
  }) => void;
}

const MIN_ALETHEIA_SECONDS = 4.1;
const MIN_EIDOS_SPEECH_SECONDS = 10.0;

const isLiveVoiceprint = (vp: VoiceprintRecord): boolean => {
  const sid = (vp.provider_speaker_id || vp.provider_speaker_ref || "").trim();
  return (
    vp.status === "ACTIVE" &&
    Boolean(sid) &&
    !sid.startsWith("sim-") &&
    !sid.startsWith("eidos-ref-")
  );
};

export const ClipBar: React.FC<ClipBarProps> = ({
  executionMode,
  activeScenarioId,
  voiceprints,
  selectedCustomerId,
  onSelectCustomerId,
  isLoading,
  onSelectScenario,
  onClearSession,
  onAudioLevelChange,
  onAnalyzeAudio,
}) => {
  const navigate = useNavigate();
  const isLive = executionMode === "LIVE";
  const [showCustom, setShowCustom] = useState(isLive);

  // Deduplicate active customers by customer_id, always preferring a live voiceprint
  const uniqueActiveVoiceprints = useMemo(() => {
    const byCustomer = new Map<string, VoiceprintRecord>();
    for (const vp of voiceprints) {
      if (vp.status !== "ACTIVE") continue;
      const existing = byCustomer.get(vp.customer_id);
      if (!existing || (!isLiveVoiceprint(existing) && isLiveVoiceprint(vp))) {
        byCustomer.set(vp.customer_id, vp);
      }
    }
    return Array.from(byCustomer.values());
  }, [voiceprints]);

  const liveVoiceprints = useMemo(
    () => uniqueActiveVoiceprints.filter(isLiveVoiceprint),
    [uniqueActiveVoiceprints]
  );
  const demoOnlyVoiceprints = useMemo(
    () => uniqueActiveVoiceprints.filter((vp) => !isLiveVoiceprint(vp)),
    [uniqueActiveVoiceprints]
  );
  const sortedVoiceprints = useMemo(
    () => [...liveVoiceprints, ...demoOnlyVoiceprints],
    [liveVoiceprints, demoOnlyVoiceprints]
  );
  const selectedVoiceprint = useMemo(
    () => uniqueActiveVoiceprints.find((v) => v.customer_id === selectedCustomerId) || null,
    [uniqueActiveVoiceprints, selectedCustomerId]
  );
  const selectedIsLive = Boolean(selectedVoiceprint && isLiveVoiceprint(selectedVoiceprint));

  useEffect(() => {
    if (sortedVoiceprints.length === 0) return;
    if (selectedCustomerId === "UNENROLLED-CALLER") return;
    const hasCurrent = sortedVoiceprints.some((v) => v.customer_id === selectedCustomerId);
    const currentIsLive = sortedVoiceprints.some(
      (v) => v.customer_id === selectedCustomerId && isLiveVoiceprint(v)
    );
    if (!hasCurrent || (isLive && !currentIsLive && selectedCustomerId === "CUST-4821-MARCUS")) {
      const preferred = (isLive ? liveVoiceprints[0] : undefined) || sortedVoiceprints[0];
      if (preferred && preferred.customer_id !== selectedCustomerId) {
        onSelectCustomerId(preferred.customer_id);
      }
    }
  }, [sortedVoiceprints, liveVoiceprints, selectedCustomerId, isLive, onSelectCustomerId]);
  const [transcriptText, setTranscriptText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedMeta, setUploadedMeta] = useState<{
    url: string;
    duration: number;
    sampleRate: number;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{
    blob: Blob;
    url: string;
    duration: number;
    sampleRate: number;
    silenceRatio: number;
  } | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [helper] = useState(() => new AudioCaptureHelper());
  const playbackLevelTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (playbackLevelTimerRef.current !== null) {
        window.clearInterval(playbackLevelTimerRef.current);
      }
    };
  }, []);

  const stopPlaybackTelemetry = () => {
    if (playbackLevelTimerRef.current !== null) {
      window.clearInterval(playbackLevelTimerRef.current);
      playbackLevelTimerRef.current = null;
    }
    onAudioLevelChange?.(0);
  };

  const startPlaybackTelemetry = () => {
    stopPlaybackTelemetry();
    let step = 0;
    playbackLevelTimerRef.current = window.setInterval(() => {
      step = (step + 1) % 6;
      const pulse = [28, 64, 48, 82, 56, 36][step] || 40;
      onAudioLevelChange?.(pulse);
    }, 180);
  };

  const clearPreviousClip = () => {
    if (recordedAudio?.url) URL.revokeObjectURL(recordedAudio.url);
    if (uploadedMeta?.url) URL.revokeObjectURL(uploadedMeta.url);
    setRecordedAudio(null);
    setUploadedFile(null);
    setUploadedMeta(null);
    setAudioErr(null);
    onClearSession?.();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    clearPreviousClip();
    try {
      const converted = await transcodeBlobToWav16k(file);
      const wavFile = new File([converted.blob], file.name.replace(/\.[^.]+$/, ".wav"), {
        type: "audio/wav",
      });
      const previewUrl = URL.createObjectURL(wavFile);
      setUploadedFile(wavFile);
      setUploadedMeta({
        url: previewUrl,
        duration: converted.quality.durationSeconds,
        sampleRate: converted.quality.sampleRate,
      });
      if (converted.quality.durationSeconds <= 4.0) {
        setAudioErr(
          `Clip duration is ${converted.quality.durationSeconds.toFixed(1)}s — Aletheia requires > 4.0 seconds.`
        );
      }
    } catch {
      const previewUrl = URL.createObjectURL(file);
      setUploadedFile(file);
      setUploadedMeta({ url: previewUrl, duration: 5.0, sampleRate: 16000 });
    }
  };

  const toggleRecording = async () => {
    setAudioErr(null);
    if (isRecording) {
      try {
        const res = await helper.stop();
        setIsRecording(false);
        setMicLevel(0);
        onAudioLevelChange?.(0);
        setRecordedAudio({
          blob: res.blob,
          url: res.url,
          duration: res.durationSeconds,
          sampleRate: res.quality.sampleRate,
          silenceRatio: res.quality.silenceRatio,
        });
        if (res.durationSeconds <= 4.0) {
          setAudioErr(
            `Recorded clip is only ${res.durationSeconds.toFixed(1)}s — record more than 4.0 seconds for Aletheia deepfake detection.`
          );
        }
      } catch (err) {
        setIsRecording(false);
        setAudioErr(err instanceof Error ? err.message : "Failed to finish audio capture.");
      }
    } else {
      clearPreviousClip();
      try {
        await helper.start((lvl) => {
          setMicLevel(lvl);
          onAudioLevelChange?.(lvl);
        });
        setIsRecording(true);
      } catch (err) {
        setIsRecording(false);
        setAudioErr(err instanceof Error ? err.message : "Microphone permission denied.");
      }
    }
  };

  const activeDuration = uploadedMeta?.duration ?? recordedAudio?.duration ?? null;
  const activeSpeechDuration =
    recordedAudio !== null
      ? Number((recordedAudio.duration * Math.max(0, 1 - recordedAudio.silenceRatio)).toFixed(1))
      : activeDuration;
  const activePreviewUrl = uploadedMeta?.url ?? recordedAudio?.url ?? null;
  const activeSampleRate = uploadedMeta?.sampleRate ?? recordedAudio?.sampleRate ?? null;
  const clipTooShort = activeDuration !== null && activeDuration <= 4.0;
  const eidosClipTooShort =
    activeSpeechDuration !== null && activeSpeechDuration < MIN_EIDOS_SPEECH_SECONDS;
  const hasClip = Boolean(uploadedFile || recordedAudio);

  const handleAnalyzeCustom = () => {
    const audio = uploadedFile || recordedAudio?.blob;
    if ((!audio && !transcriptText.trim()) || isLoading || clipTooShort) return;
    const selectedVp = uniqueActiveVoiceprints.find((v) => v.customer_id === selectedCustomerId);
    onAnalyzeAudio({
      file: audio || undefined,
      filename: uploadedFile?.name || "mic_capture_16k.wav",
      transcript_text: transcriptText,
      claimed_customer_id: selectedCustomerId,
      caller_label: selectedVp ? `${selectedVp.customer_name} (${selectedCustomerId})` : selectedCustomerId,
      duration_hint_sec: activeSpeechDuration ?? activeDuration ?? undefined,
    });
  };

  return (
    <Card className="!p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {DEMO_SCENARIO_LIST.map((sc) => {
            const isActive = activeScenarioId === sc.id && !isLive;
            return (
              <button
                key={sc.id}
                type="button"
                disabled={isLoading || isLive}
                title={isLive ? "Switch to DEMO mode to run pre-recorded scenarios" : sc.label}
                onClick={() => {
                  setShowCustom(false);
                  onSelectScenario(sc.id as "S1" | "S2" | "S3" | "S4");
                }}
                className={`px-3 py-1.5 rounded-lg text-[14px] font-semibold border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--fill-subtle)]"
                }`}
              >
                <span>{sc.id}</span>
                <span
                  className={`text-[14px] px-1.5 rounded font-medium ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[var(--mode-demo-bg)] text-[var(--mode-demo-text)]"
                  }`}
                >
                  {copy.modes.demo}
                </span>
              </button>
            );
          })}
          {isLive && (
            <span className="text-[14px] font-medium text-[var(--text-muted)]">
              LIVE mode: demo clips disabled (no cached/mock fallbacks)
            </span>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={isLoading}
          onClick={() => setShowCustom((v) => !v)}
          icon={showCustom ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        >
          {copy.clipSelector.recordOrUpload}
        </Button>
      </div>

      {(showCustom || isLive) && (
        <div className="pt-3 border-t border-[var(--border)] space-y-3">
          {audioErr && (
            <Banner variant="error">
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {audioErr}
              </span>
            </Banner>
          )}

          <div className="space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="claimed-customer-select"
                  className="text-[14px] font-medium text-[var(--text-secondary)]"
                >
                  {copy.clipSelector.claimedUserLabel}
                </label>
                {selectedIsLive ? (
                  <Badge variant="success" size="sm">Live</Badge>
                ) : (
                  <Badge variant="warning" size="sm">Demo only</Badge>
                )}
              </div>
              <select
                id="claimed-customer-select"
                value={selectedCustomerId}
                onChange={(e) => onSelectCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)] text-[var(--text-primary)]"
              >
                {isLive ? (
                  <>
                    <optgroup label="Live-Enrolled (DetectifAI Eidos)">
                      {liveVoiceprints.length === 0 ? (
                        <option value="" disabled>
                          No live Voice ID enrolled yet
                        </option>
                      ) : (
                        liveVoiceprints.map((vp) => (
                          <option key={vp.voiceprint_id} value={vp.customer_id}>
                            [Live] {vp.customer_name} ({vp.customer_id})
                          </option>
                        ))
                      )}
                    </optgroup>
                    <optgroup label="Demo only (cannot verify live)">
                      {demoOnlyVoiceprints.map((vp) => (
                        <option key={vp.voiceprint_id} value={vp.customer_id}>
                          {vp.customer_name} ({vp.customer_id}) · Demo only
                        </option>
                      ))}
                      <option value="UNENROLLED-CALLER">Unenrolled Caller (Demo / No ID)</option>
                    </optgroup>
                  </>
                ) : (
                  <>
                    {sortedVoiceprints.map((vp) => (
                      <option key={vp.voiceprint_id} value={vp.customer_id}>
                        {vp.customer_name} ({vp.customer_id}) ·{" "}
                        {isLiveVoiceprint(vp) ? "Live Voice ID" : "Demo Only"}
                      </option>
                    ))}
                    <option value="UNENROLLED-CALLER">Unenrolled Caller</option>
                  </>
                )}
              </select>
            </div>

            {isLive && !selectedIsLive && (
              <Banner variant="warn" title="No live Voice ID">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    No live Voice ID: Eidos will be skipped. Enroll one or pick a live customer.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="whitespace-nowrap shrink-0"
                    onClick={() => {
                      const q = new URLSearchParams();
                      if (selectedCustomerId && selectedCustomerId !== "UNENROLLED-CALLER") {
                        q.set("customer_id", selectedCustomerId);
                      }
                      if (selectedVoiceprint?.customer_name) {
                        q.set("customer_name", selectedVoiceprint.customer_name);
                      }
                      navigate(`/enroll${q.toString() ? `?${q.toString()}` : ""}`);
                    }}
                  >
                    Enroll live Voice ID
                  </Button>
                </div>
              </Banner>
            )}

            {isLive && hasClip && !clipTooShort && eidosClipTooShort && (
              <Banner variant="warn" title="Clip too short for speaker verification">
                Speech duration is {activeSpeechDuration?.toFixed(1)}s (need &gt;= 10 s of speech); Eidos will be skipped at 0 credits.
              </Banner>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Button
                  variant={isRecording ? "danger" : "secondary"}
                  size="sm"
                  className="whitespace-nowrap shrink-0"
                  onClick={toggleRecording}
                  icon={isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                >
                  {isRecording ? `Stop (${micLevel}%)` : "Record 16 kHz WAV"}
                </Button>

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--fill-subtle)] text-[14px] font-semibold text-[var(--brand-steel)] cursor-pointer whitespace-nowrap shrink-0">
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>{copy.clipSelector.tabUpload}</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>

                {(uploadedFile || recordedAudio) && (
                  <span className="text-[14px] text-[var(--text-secondary)] flex items-center gap-1 truncate max-w-[220px]">
                    <FileAudio className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
                    {uploadedFile
                      ? uploadedFile.name
                      : `${formatDuration(recordedAudio?.duration)} (${Math.round((1 - (recordedAudio?.silenceRatio || 0)) * 100)}% speech)`}
                  </span>
                )}
              </div>

              <Button
                variant="primary"
                size="sm"
                loading={isLoading}
                disabled={(!hasClip && !transcriptText.trim()) || isRecording || clipTooShort}
                onClick={handleAnalyzeCustom}
                className="whitespace-nowrap shrink-0"
              >
                {clipTooShort
                  ? `Clip < ${MIN_ALETHEIA_SECONDS.toFixed(0)}s`
                  : isLive
                  ? "Analyze LIVE (Fresh)"
                  : copy.clipSelector.runAnalysisButton}
              </Button>
            </div>
          </div>

          {activePreviewUrl && (
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                  <FileAudio className="w-4 h-4 text-[var(--brand-steel)]" />
                  Audio Preview ({activeDuration !== null ? `${activeDuration.toFixed(1)}s` : "—"}
                  {activeSampleRate ? ` · ${activeSampleRate} Hz PCM WAV` : ""})
                </span>
                <button
                  type="button"
                  onClick={clearPreviousClip}
                  className="text-[14px] font-medium text-[var(--brand-steel)] hover:underline cursor-pointer"
                >
                  Clear clip
                </button>
              </div>
              <audio
                controls
                src={activePreviewUrl}
                onPlay={startPlaybackTelemetry}
                onPause={stopPlaybackTelemetry}
                onEnded={stopPlaybackTelemetry}
                className="w-full h-9"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="caller-transcript-input"
              className="block text-[14px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Caller Transcript (fed into Layer 3 Script Analysis & Layer 4 Manipulation Analysis)
            </label>
            <textarea
              id="caller-transcript-input"
              rows={2}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Optional spoken/ASR transcript (e.g., 'This is Fraud Department. Your account will be frozen unless you read the OTP right now!')"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      )}
    </Card>
  );
};
