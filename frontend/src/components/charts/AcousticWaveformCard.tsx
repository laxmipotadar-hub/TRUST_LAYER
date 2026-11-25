import { useEffect, useRef } from 'react';
import { Radio } from 'lucide-react';
import type { AudioProfile } from '../../types/aegis';
import { callAudioController } from '../../utils/audioEngine';

interface AcousticWaveformCardProps {
  profile: AudioProfile;
  isMonitoring: boolean;
  verdictColorHex: string;
}

export function AcousticWaveformCard({
  profile,
  isMonitoring,
  verdictColorHex,
}: AcousticWaveformCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let y = height / 4; y < height; y += height / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const analyser = callAudioController.getAnalyser();
      ctx.beginPath();
      ctx.strokeStyle = verdictColorHex;
      ctx.lineWidth = 2;

      if (isMonitoring && analyser) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(buffer);
        const slice = width / buffer.length;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * slice, y);
        }
      } else {
        const freqFactor = profile.pitch_hz / 40;
        const harmonicAmp = 0.25 + profile.synthetic_cadence_index * 0.35;
        const echoOffset = profile.replay_echo_correlation * 0.4;
        for (let x = 0; x < width; x++) {
          const t = (x / width) * Math.PI * 2 * freqFactor + phase;
          const base = Math.sin(t) * 0.55;
          const harmonic = Math.sin(t * 2.02) * harmonicAmp;
          const echo = Math.sin(t - 0.8) * echoOffset;
          const y = height / 2 + (base + harmonic + echo) * (height * 0.28);
          if (x === 0) ctx.moveTo(0, y);
          else ctx.lineTo(x, y);
        }
        phase += isMonitoring ? 0.09 : 0.02;
      }
      ctx.stroke();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [profile, isMonitoring, verdictColorHex]);

  const metrics = [
    { label: 'Pitch F0', value: `${profile.pitch_hz.toFixed(1)} Hz` },
    { label: 'Vocal Jitter', value: `${profile.jitter_pct.toFixed(2)}%` },
    { label: 'HNR', value: `${profile.harmonic_noise_ratio_db.toFixed(1)} dB` },
    { label: 'Spectral Flatness', value: profile.spectral_flatness.toFixed(2) },
    { label: 'Synthetic Cadence', value: profile.synthetic_cadence_index.toFixed(2) },
    { label: 'Replay Echo Corr', value: profile.replay_echo_correlation.toFixed(2) },
  ];

  return (
    <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            Web Audio Acoustic Signal Monitor
          </h2>
        </div>
        <span className="font-mono text-[11px] text-[#94a3b8]">
          {isMonitoring ? 'LIVE WEB AUDIO STREAM' : 'TELEMETRY WAVEFORM'}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0a0f1e]">
        <canvas ref={canvasRef} width={760} height={100} className="h-24 w-full" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-md border border-slate-800 bg-[#151e30] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#94a3b8]">{m.label}</div>
            <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-[#f8fafc]">
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
