import React, { useState } from "react";
import { Mic, Upload, FileAudio, StopCircle, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
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
  isLoading: boolean;
  onSelectScenario: (id: "S1" | "S2" | "S3" | "S4") => void;
  onAnalyzeAudio: (params: {
    file?: Blob;
    filename?: string;
    transcript_text: string;
    claimed_customer_id: string;
    caller_label?: string;
    duration_hint_sec?: number;
  }) => void;
}

export const ClipBar: React.FC<ClipBarProps> = ({
  executionMode,
  activeScenarioId,
  voiceprints,
  isLoading,
  onSelectScenario,
  onAnalyzeAudio,
}) => {
  const isLive = executionMode === "LIVE";
  const [showCustom, setShowCustom] = useState(isLive);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    voiceprints.find((v) => v.status === "ACTIVE")?.customer_id || "CUST-4821-MARCUS"
  );
  const [transcriptText, setTranscriptText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{
    blob: Blob;
    duration: number;
    silenceRatio: number;
  } | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [helper] = useState(() => new AudioCaptureHelper());

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioErr(null);
    setRecordedAudio(null);
    try {
      const converted = await transcodeBlobToWav16k(file);
      setUploadedFile(new File([converted.blob], file.name.replace(/\.[^.]+$/, ".wav"), { type: "audio/wav" }));
    } catch {
      setUploadedFile(file);
    }
  };

  const toggleRecording = async () => {
    setAudioErr(null);
    if (isRecording) {
      try {
        const res = await helper.stop();
        setIsRecording(false);
        setMicLevel(0);
        setRecordedAudio({
          blob: res.blob,
          duration: res.durationSeconds,
          silenceRatio: res.quality.silenceRatio,
        });
        setUploadedFile(null);
      } catch (err) {
        setIsRecording(false);
        setAudioErr(err instanceof Error ? err.message : "Failed to finish audio capture.");
      }
    } else {
      try {
        await helper.start((lvl) => setMicLevel(lvl));
        setIsRecording(true);
        setRecordedAudio(null);
      } catch (err) {
        setIsRecording(false);
        setAudioErr(err instanceof Error ? err.message : "Microphone permission denied.");
      }
    }
  };

  const handleAnalyzeCustom = () => {
    const audio = uploadedFile || recordedAudio?.blob;
    if ((!audio && !transcriptText.trim()) || isLoading) return;
    const selectedVp = voiceprints.find((v) => v.customer_id === selectedCustomerId);
    onAnalyzeAudio({
      file: audio || undefined,
      filename: uploadedFile?.name || "mic_capture_16k.wav",
      transcript_text: transcriptText,
      claimed_customer_id: selectedCustomerId,
      caller_label: selectedVp ? `${selectedVp.customer_name} (${selectedCustomerId})` : selectedCustomerId,
      duration_hint_sec: recordedAudio?.duration,
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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label
                htmlFor="claimed-customer-select"
                className="block text-[14px] font-medium text-[var(--text-secondary)] mb-1"
              >
                {copy.clipSelector.claimedUserLabel}
              </label>
              <select
                id="claimed-customer-select"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)] text-[var(--text-primary)]"
              >
                {voiceprints
                  .filter((vp) => vp.status === "ACTIVE")
                  .map((vp) => (
                    <option key={vp.voiceprint_id} value={vp.customer_id}>
                      {vp.customer_name} ({vp.customer_id})
                    </option>
                  ))}
                <option value="UNENROLLED-CALLER">Unenrolled Caller</option>
              </select>
            </div>

            <div className="md:col-span-5 flex flex-wrap items-center gap-2">
              <Button
                variant={isRecording ? "danger" : "secondary"}
                size="sm"
                onClick={toggleRecording}
                icon={isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              >
                {isRecording ? `Stop (${micLevel}%)` : "Record 16 kHz WAV"}
              </Button>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--fill-subtle)] text-[14px] font-semibold text-[var(--brand-steel)] cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{copy.clipSelector.tabUpload}</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {(uploadedFile || recordedAudio) && (
                <span className="text-[14px] text-[var(--text-secondary)] flex items-center gap-1 truncate max-w-[190px]">
                  <FileAudio className="w-4 h-4 text-[var(--brand-steel)] shrink-0" />
                  {uploadedFile
                    ? uploadedFile.name
                    : `${formatDuration(recordedAudio?.duration)} (${Math.round((1 - (recordedAudio?.silenceRatio || 0)) * 100)}% speech)`}
                </span>
              )}
            </div>

            <div className="md:col-span-3 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                loading={isLoading}
                disabled={(!uploadedFile && !recordedAudio && !transcriptText.trim()) || isRecording}
                onClick={handleAnalyzeCustom}
                className="w-full"
              >
                {isLive ? "Analyze LIVE (Fresh)" : copy.clipSelector.runAnalysisButton}
              </Button>
            </div>
          </div>

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
