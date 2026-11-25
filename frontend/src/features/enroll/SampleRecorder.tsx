import React, { useState } from "react";
import { Mic, StopCircle, Upload, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { copy } from "../../copy";
import { useRecorder } from "../../lib/audio";
import { formatDuration } from "../../lib/format";

export interface SampleValue {
  blob: Blob;
  url: string;
  duration: number;
  label: string;
}

export interface SampleRecorderProps {
  label: string;
  sample: SampleValue | null;
  onChange: (sample: SampleValue | null) => void;
  requiredDuration?: boolean;
}

export const SampleRecorder: React.FC<SampleRecorderProps> = ({
  label,
  sample,
  onChange,
  requiredDuration = true,
}) => {
  const recorder = useRecorder();
  const [durationError, setDurationError] = useState<string | null>(null);

  const validateAndSet = (blob: Blob, url: string, duration: number, name: string) => {
    if (requiredDuration && (duration < 20 || duration > 60)) {
      setDurationError(copy.enroll.durationRuleError);
      onChange(null);
      return;
    }
    setDurationError(null);
    onChange({ blob, url, duration, label: name });
  };

  const handleStop = async () => {
    const res = await recorder.stopRecording();
    if (res) {
      validateAndSet(res.blob, res.url, res.durationSeconds, "Recorded sample");
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const audioEl = new Audio(url);
    audioEl.onloadedmetadata = () => {
      const dur = isFinite(audioEl.duration) ? audioEl.duration : 24;
      validateAndSet(file, url, dur, file.name);
    };
    audioEl.onerror = () => {
      validateAndSet(file, url, 24, file.name);
    };
  };

  const progressPct = Math.min(100, Math.round((recorder.elapsedSeconds / 30) * 100));

  return (
    <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-[var(--text-primary)]">{label}</span>
        {recorder.status === "recording" && (
          <span className="text-[14px] font-mono font-bold text-[var(--decision-endcall-solid)]">
            {recorder.elapsedSeconds.toFixed(1)}s / 30.0s
          </span>
        )}
      </div>

      {recorder.status === "recording" && (
        <div className="space-y-1.5">
          <div className="w-full h-2.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-steel)] transition-all duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="caption-text">Mic level: {recorder.level}% (target 20–30 s)</p>
        </div>
      )}

      {sample && (
        <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg space-y-2">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-medium text-[var(--text-primary)] truncate">
              {sample.label} ({formatDuration(sample.duration)})
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              {copy.enroll.retryRecord}
            </Button>
          </div>
          <audio controls src={sample.url} className="w-full h-9" />
        </div>
      )}

      {durationError && (
        <p className="text-[14px] font-medium text-[var(--decision-endcall-text)]">
          {durationError}
        </p>
      )}

      {!sample && (
        <div className="flex flex-wrap items-center gap-2">
          {recorder.status === "recording" ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleStop}
              icon={<StopCircle className="w-4 h-4" />}
            >
              {copy.clipSelector.stopRecord}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setDurationError(null);
                recorder.startRecording();
              }}
              icon={<Mic className="w-4 h-4" />}
            >
              {copy.enroll.recordTab}
            </Button>
          )}

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--border)] text-[14px] font-medium cursor-pointer">
            <Upload className="w-4 h-4 text-[var(--brand-steel)]" />
            <span>{copy.enroll.uploadTab}</span>
            <input type="file" accept="audio/*" onChange={handleFile} className="hidden" />
          </label>
        </div>
      )}
    </div>
  );
};
