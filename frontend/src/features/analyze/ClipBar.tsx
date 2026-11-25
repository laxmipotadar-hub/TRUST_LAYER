import React, { useState } from "react";
import { Mic, Upload, FileAudio, StopCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { copy } from "../../copy";
import { DEMO_SCENARIO_LIST } from "../../mocks/fixtures";
import { AudioCaptureHelper } from "../../lib/audio";
import { formatDuration } from "../../lib/format";
import type { Voiceprint } from "../../types";

export interface ClipBarProps {
  activeScenarioId: string | null;
  voiceprints: Voiceprint[];
  isLoading: boolean;
  onSelectScenario: (id: "S1" | "S2" | "S3" | "S4") => void;
  onAnalyzeCustomAudio: (audio: Blob, claimedUserId: string) => void;
}

export const ClipBar: React.FC<ClipBarProps> = ({
  activeScenarioId,
  voiceprints,
  isLoading,
  onSelectScenario,
  onAnalyzeCustomAudio,
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    voiceprints[0]?.claimed_user_id || "CUST-4821-MARCUS"
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; duration: number } | null>(null);
  const [recorder] = useState(() => new AudioCaptureHelper());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadedFile(e.target.files[0]);
      setRecordedAudio(null);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      try {
        const res = await recorder.stop();
        setIsRecording(false);
        setRecordedAudio({ blob: res.blob, duration: res.durationSeconds });
        setUploadedFile(null);
      } catch {
        setIsRecording(false);
      }
    } else {
      try {
        await recorder.start();
        setIsRecording(true);
        setRecordedAudio(null);
      } catch {
        setIsRecording(false);
      }
    }
  };

  const handleAnalyzeCustom = () => {
    const audio = uploadedFile || recordedAudio?.blob;
    if (!audio || isLoading) return;
    onAnalyzeCustomAudio(audio, selectedUserId);
  };

  return (
    <Card className="!p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {DEMO_SCENARIO_LIST.map((sc) => {
            const isActive = activeScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setShowCustom(false);
                  onSelectScenario(sc.id as "S1" | "S2" | "S3" | "S4");
                }}
                className={`px-3 py-1.5 rounded-lg text-[14px] font-semibold border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)] ${
                  isActive
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--fill-subtle)]"
                }`}
              >
                <span>{sc.id}</span>
                <span
                  className={`text-[12px] px-1.5 py-0.2 rounded font-medium ${
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

      {showCustom && (
        <div className="pt-3 border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label
              htmlFor="claimed-customer-select"
              className="block text-[14px] font-medium text-[var(--text-primary)] mb-1"
            >
              {copy.clipSelector.claimedCustomer}
            </label>
            <select
              id="claimed-customer-select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)] text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--brand-steel)]"
            >
              {voiceprints
                .filter((vp) => vp.status !== "revoked")
                .map((vp) => (
                  <option key={vp.id} value={vp.claimed_user_id}>
                    {vp.user_name} ({vp.claimed_user_id})
                  </option>
                ))}
              <option value="UNENROLLED-CALLER">{copy.clipSelector.unenrolledOption}</option>
            </select>
          </div>

          <div className="md:col-span-5 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] font-medium bg-[var(--fill-subtle)] hover:bg-[var(--border)] cursor-pointer text-[var(--text-primary)]">
              <Upload className="w-4 h-4 text-[var(--brand-steel)]" />
              <span className="truncate max-w-[140px]">
                {uploadedFile ? uploadedFile.name : copy.clipSelector.tabUpload}
              </span>
              <input type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
            </label>

            <Button
              variant={isRecording ? "danger" : "secondary"}
              size="sm"
              onClick={toggleRecording}
              icon={isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            >
              {isRecording
                ? copy.clipSelector.stopRecord
                : recordedAudio
                ? formatDuration(recordedAudio.duration)
                : copy.clipSelector.tabRecord}
            </Button>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              loading={isLoading}
              disabled={isLoading || (!uploadedFile && !recordedAudio)}
              onClick={handleAnalyzeCustom}
              icon={<FileAudio className="w-4 h-4" />}
            >
              {copy.clipSelector.runAnalysisButton}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
