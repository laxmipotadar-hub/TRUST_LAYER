/**
 * Web Audio API dual-tone ringtone generator (no external audio assets).
 * Respects browser autoplay policy and provides a gesture-unlock fallback + mute control.
 */
export interface RingtoneStatus {
  playing: boolean;
  muted: boolean;
  audioBlocked: boolean;
}

class WebAudioRingtone {
  private ctx: AudioContext | null = null;
  private pulseTimer: number | null = null;
  private activeOscs: OscillatorNode[] = [];
  private muted = false;
  private playing = false;
  private audioBlocked = false;
  private listeners = new Set<(status: RingtoneStatus) => void>();

  private notify() {
    const snap = this.getStatus();
    this.listeners.forEach((cb) => cb(snap));
  }

  subscribe(cb: (status: RingtoneStatus) => void): () => void {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => {
      this.listeners.delete(cb);
    };
  }

  getStatus(): RingtoneStatus {
    return {
      playing: this.playing,
      muted: this.muted,
      audioBlocked: this.audioBlocked,
    };
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === "closed") {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private stopBurst() {
    for (const osc of this.activeOscs) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore stopped oscillator errors
      }
    }
    this.activeOscs = [];
  }

  private playBurst() {
    if (this.muted || !this.playing) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      this.audioBlocked = true;
      this.notify();
      return;
    }

    this.stopBurst();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
    gain.gain.setValueAtTime(0.08, now + 0.95);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
    gain.connect(ctx.destination);

    for (const freq of [440, 480]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 1.1);
      this.activeOscs.push(osc);
    }
  }

  async unlockAndStart(): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
        this.audioBlocked = false;
      } catch {
        this.audioBlocked = true;
      }
    }
    if (this.playing && !this.muted) {
      this.playBurst();
    }
    this.notify();
  }

  async start(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
        this.audioBlocked = false;
      } catch {
        this.audioBlocked = true;
      }
    } else if (!ctx) {
      this.audioBlocked = false;
    }

    if (!this.muted && !this.audioBlocked) {
      this.playBurst();
    }
    if (typeof window !== "undefined") {
      this.pulseTimer = window.setInterval(() => {
        this.playBurst();
      }, 2800);
    }
    this.notify();
  }

  stop(): void {
    this.playing = false;
    if (this.pulseTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    this.stopBurst();
    this.notify();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopBurst();
    } else if (this.playing) {
      this.playBurst();
    }
    this.notify();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  dispose(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}

export const ringtonePlayer = new WebAudioRingtone();
