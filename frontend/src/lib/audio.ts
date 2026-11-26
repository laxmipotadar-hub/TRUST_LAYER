import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioQualityMetrics {
  durationSeconds: number;
  silenceRatio: number;
  clippedRatio: number;
  rms: number;
  sampleRate: number;
}

export interface AudioRecordingResult {
  blob: Blob;
  durationSeconds: number;
  url: string;
  quality: AudioQualityMetrics;
  pcm16: Int16Array;
}

const TARGET_SAMPLE_RATE = 16000;

export function resampleFloat32(
  samples: Float32Array,
  fromRate: number,
  toRate: number = TARGET_SAMPLE_RATE
): Float32Array {
  // Kept only for synchronous helpers; live capture uses OfflineAudioContext anti-aliased resampling.
  if (fromRate === toRate || samples.length === 0) return samples;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = samples[Math.min(idx, samples.length - 1)];
    const s1 = samples[Math.min(idx + 1, samples.length - 1)];
    result[i] = s0 + (s1 - s0) * frac;
  }
  return result;
}

export async function resampleWithOfflineAudioContext(
  samples: Float32Array,
  fromRate: number,
  toRate: number = TARGET_SAMPLE_RATE
): Promise<{ samples: Float32Array; sampleRate: number }> {
  if (samples.length === 0) return { samples, sampleRate: toRate };
  if (fromRate === toRate) return { samples, sampleRate: toRate };

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  if (!OfflineCtx) {
    // Preserve native sampleRate in WAV header rather than corrupting pitch/aliasing
    return { samples, sampleRate: fromRate };
  }

  try {
    const targetLength = Math.max(1, Math.ceil((samples.length * toRate) / fromRate));
    const offline = new OfflineCtx(1, targetLength, toRate);
    const buffer = offline.createBuffer(1, samples.length, fromRate);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return {
      samples: new Float32Array(rendered.getChannelData(0)),
      sampleRate: rendered.sampleRate,
    };
  } catch {
    // Safe fallback: return original native sampleRate so WAV header matches PCM rate 1:1
    return { samples, sampleRate: fromRate };
  }
}

export function float32ToInt16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return pcm;
}

export function computeQualityMetrics(
  samples: Float32Array,
  sampleRate: number
): AudioQualityMetrics {
  if (samples.length === 0) {
    return { durationSeconds: 0, silenceRatio: 1, clippedRatio: 0, rms: 0, sampleRate };
  }
  let sumSq = 0;
  let silent = 0;
  let clipped = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i];
    sumSq += v * v;
    if (Math.abs(v) < 0.008) silent += 1;
    if (Math.abs(v) >= 0.98) clipped += 1;
  }
  return {
    durationSeconds: round2(samples.length / sampleRate),
    silenceRatio: round2(silent / samples.length),
    clippedRatio: round2(clipped / samples.length),
    rms: round2(Math.sqrt(sumSq / samples.length)),
    sampleRate,
  };
}

function round2(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

export function encodePcm16MonoWav(pcm16: Int16Array, sampleRate: number = TARGET_SAMPLE_RATE): Blob {
  const dataSize = pcm16.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  const out = new Int16Array(buf, 44);
  out.set(pcm16);
  return new Blob([buf], { type: "audio/wav" });
}

export async function transcodeBlobToWav16k(rawBlob: Blob): Promise<{
  blob: Blob;
  quality: AudioQualityMetrics;
  pcm16: Int16Array;
}> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arr = await rawBlob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arr);
    // Downmix multi-channel inputs cleanly to mono before anti-aliased resampling
    const length = decoded.length;
    const channels = decoded.numberOfChannels;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < channels; ch += 1) {
      const chData = decoded.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        mono[i] += chData[i] / channels;
      }
    }
    const { samples: resampled, sampleRate: outRate } = await resampleWithOfflineAudioContext(
      mono,
      decoded.sampleRate,
      TARGET_SAMPLE_RATE
    );
    const quality = computeQualityMetrics(resampled, outRate);
    const pcm16 = float32ToInt16(resampled);
    const blob = encodePcm16MonoWav(pcm16, outRate);
    return { blob, quality, pcm16 };
  } finally {
    await ctx.close().catch(() => {});
  }
}

export function int16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function concatWavSamplesTo16kBlob(samplesList: Int16Array[]): Blob {
  const totalLen = samplesList.reduce((sum, s) => sum + s.length, 0);
  const merged = new Int16Array(totalLen);
  let offset = 0;
  for (const s of samplesList) {
    merged.set(s, offset);
    offset += s.length;
  }
  return encodePcm16MonoWav(merged, TARGET_SAMPLE_RATE);
}

/** AudioWorklet processor source compiled via Blob URL for real-time 16 kHz mono capture. */
const WORKLET_PROCESSOR_SRC = `
class AegisPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor('aegis-pcm-processor', AegisPcmProcessor);
`;

export interface LiveWorkletController {
  stop: () => Promise<AudioRecordingResult>;
}

export async function startAudioWorkletCapture(options: {
  onChunk?: (pcm16Chunk: Int16Array, rmsLevel: number, waveformPoints: number[]) => void;
  onLevel?: (level: number) => void;
}): Promise<LiveWorkletController> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone API is unavailable in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);

  const rawFrames: Float32Array[] = [];
  const pendingFloat: number[] = [];
  const sampleRateIn = ctx.sampleRate;
  const chunkTargetSamples = TARGET_SAMPLE_RATE; // emit every ~1s of 16 kHz PCM
  let cleanupNode: () => void = () => {};

  const pushFrame = (frame: Float32Array) => {
    rawFrames.push(frame);
    let sumSq = 0;
    for (let i = 0; i < frame.length; i += 1) sumSq += frame[i] * frame[i];
    const rms = Math.sqrt(sumSq / Math.max(1, frame.length));
    const level = Math.min(100, Math.round(rms * 350));
    options.onLevel?.(level);

    const resampled = resampleFloat32(frame, sampleRateIn, TARGET_SAMPLE_RATE);
    for (let i = 0; i < resampled.length; i += 1) pendingFloat.push(resampled[i]);

    if (pendingFloat.length >= chunkTargetSamples) {
      const slice = new Float32Array(pendingFloat.splice(0, chunkTargetSamples));
      const pcm = float32ToInt16(slice);
      const bars: number[] = [];
      const step = Math.max(1, Math.floor(slice.length / 24));
      for (let i = 0; i < slice.length; i += step) {
        bars.push(Math.min(100, Math.round(Math.abs(slice[i]) * 260)));
      }
      options.onChunk?.(pcm, level, bars.slice(0, 24));
    }
  };

  if (ctx.audioWorklet) {
    const blobUrl = URL.createObjectURL(
      new Blob([WORKLET_PROCESSOR_SRC], { type: "application/javascript" })
    );
    try {
      await ctx.audioWorklet.addModule(blobUrl);
      const node = new AudioWorkletNode(ctx, "aegis-pcm-processor");
      node.port.onmessage = (evt: MessageEvent<Float32Array>) => pushFrame(evt.data);
      source.connect(node);
      node.connect(ctx.destination);
      cleanupNode = () => {
        node.port.onmessage = null;
        node.disconnect();
        URL.revokeObjectURL(blobUrl);
      };
    } catch {
      URL.revokeObjectURL(blobUrl);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (evt) => pushFrame(new Float32Array(evt.inputBuffer.getChannelData(0)));
      source.connect(proc);
      proc.connect(ctx.destination);
      cleanupNode = () => {
        proc.onaudioprocess = null;
        proc.disconnect();
      };
    }
  } else {
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (evt) => pushFrame(new Float32Array(evt.inputBuffer.getChannelData(0)));
    source.connect(proc);
    proc.connect(ctx.destination);
    cleanupNode = () => {
      proc.onaudioprocess = null;
      proc.disconnect();
    };
  }

  return {
    stop: async () => {
      cleanupNode();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await ctx.close().catch(() => {});

      const totalRaw = rawFrames.reduce((s, f) => s + f.length, 0);
      const mergedRaw = new Float32Array(totalRaw);
      let pos = 0;
      for (const f of rawFrames) {
        mergedRaw.set(f, pos);
        pos += f.length;
      }
      const { samples: resampled, sampleRate: outRate } = await resampleWithOfflineAudioContext(
        mergedRaw,
        sampleRateIn,
        TARGET_SAMPLE_RATE
      );
      const quality = computeQualityMetrics(resampled, outRate);
      const pcm16 = float32ToInt16(resampled);
      if (pendingFloat.length > 0 && options.onChunk) {
        const rem = float32ToInt16(new Float32Array(pendingFloat));
        options.onChunk(rem, 0, []);
      }
      const blob = encodePcm16MonoWav(pcm16, outRate);
      const url = URL.createObjectURL(blob);
      return {
        blob,
        durationSeconds: quality.durationSeconds,
        url,
        quality,
        pcm16,
      };
    },
  };
}

export class AudioCaptureHelper {
  private controller: LiveWorkletController | null = null;

  async start(onLevel?: (level: number) => void): Promise<void> {
    this.controller = await startAudioWorkletCapture({ onLevel });
  }

  async stop(): Promise<AudioRecordingResult> {
    if (!this.controller) {
      throw new Error("AudioCaptureHelper not started");
    }
    const res = await this.controller.stop();
    this.controller = null;
    return res;
  }

  cancel(): void {
    this.controller?.stop().catch(() => {});
    this.controller = null;
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

  const workletRef = useRef<LiveWorkletController | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLevel(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startRecording = useCallback(async () => {
    setErrorReason(null);
    setElapsedSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorReason("UNSUPPORTED");
      return false;
    }
    try {
      setStatus("requesting_permission");
      workletRef.current = await startAudioWorkletCapture({
        onLevel: (lvl) => setLevel(lvl),
      });
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      setStatus("recording");
      return true;
    } catch {
      cleanup();
      setStatus("error");
      setErrorReason("PERMISSION_DENIED");
      return false;
    }
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<AudioRecordingResult | null> => {
    const active = workletRef.current;
    workletRef.current = null;
    cleanup();
    setStatus("idle");
    if (!active) return null;
    return active.stop();
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    workletRef.current?.stop().catch(() => {});
    workletRef.current = null;
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
