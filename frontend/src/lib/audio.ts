import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Audio recorder & playback helper for live microphone capture
 */

export interface AudioRecordingResult {
  blob: Blob;
  durationSeconds: number;
  url: string;
}

export class AudioCaptureHelper {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start();
  }

  stop(): Promise<AudioRecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error("MediaRecorder not initialized"));
      }

      this.mediaRecorder.onstop = () => {
        const duration = (Date.now() - this.startTime) / 1000;
        const blob = new Blob(this.audioChunks, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        resolve({
          blob,
          durationSeconds: duration,
          url,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
  }
}

export type RecorderStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "uploading"
  | "error";

export type RecorderErrorReason =
  | "PERMISSION_DENIED"
  | "UNSUPPORTED"
  | "CUT_OFF"
  | null;

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [level, setLevel] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorReason, setErrorReason] = useState<RecorderErrorReason>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    setErrorReason(null);
    setElapsedSeconds(0);
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error");
      setErrorReason("UNSUPPORTED");
      return false;
    }

    try {
      setStatus("requesting_permission");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Detect unexpected cut-off
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            setStatus("error");
            setErrorReason("CUT_OFF");
            cleanup();
          }
        };
      });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Audio level meter via AnalyserNode
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevel(Math.min(100, Math.round(rms * 350)));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }

      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((Date.now() - startTimeRef.current) / 1000);
      }, 100);

      recorder.start();
      setStatus("recording");
      return true;
    } catch {
      cleanup();
      setStatus("error");
      setErrorReason("PERMISSION_DENIED");
      return false;
    }
  }, [cleanup]);

  const stopRecording = useCallback((): Promise<AudioRecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        setStatus("idle");
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        cleanup();
        resolve({ blob, durationSeconds: duration, url });
      };

      recorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    cleanup();
    setStatus("idle");
    setElapsedSeconds(0);
    setErrorReason(null);
  }, [cleanup]);

  return {
    status,
    setStatus,
    level,
    elapsedSeconds,
    errorReason,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
