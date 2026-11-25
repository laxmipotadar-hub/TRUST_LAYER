import type { AudioProfile, TranscriptSegment } from '../types/aegis';

/**
 * Web Audio API telemetry synthesizer + Browser Speech Synthesis controller.
 * Provides live acoustic waveform rendering and optional spoken call simulation.
 */
export class CallAudioController {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activeNodes: AudioNode[] = [];
  private speechCancelled = false;

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public startAcousticMonitor(profile: AudioProfile, audibleTone: boolean): void {
    this.stopAcousticMonitor();

    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    const masterGain = ctx.createGain();
    masterGain.gain.value = audibleTone ? 0.04 : 0.0001;

    // Fundamental vocal carrier
    const oscPrimary = ctx.createOscillator();
    oscPrimary.type = profile.synthetic_cadence_index > 0.6 ? 'sawtooth' : 'sine';
    oscPrimary.frequency.value = profile.pitch_hz;

    // Harmonic overtone
    const oscHarmonic = ctx.createOscillator();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.value = profile.pitch_hz * 2.01;

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = profile.synthetic_cadence_index > 0.6 ? 0.42 : 0.22;

    // LFO for natural vocal jitter vs robotic stability
    const lfo = ctx.createOscillator();
    lfo.frequency.value = profile.synthetic_cadence_index > 0.6 ? 18 : 5.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = profile.jitter_pct * 3.5;

    lfo.connect(lfoGain);
    lfoGain.connect(oscPrimary.frequency);

    // Optional delayed echo path to represent replay attack acoustic reflections
    if (profile.replay_echo_correlation > 0.5) {
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.045;
      const echoGain = ctx.createGain();
      echoGain.gain.value = 0.55;
      oscPrimary.connect(delay);
      delay.connect(echoGain);
      echoGain.connect(masterGain);
      this.activeNodes.push(delay, echoGain);
    }

    oscPrimary.connect(masterGain);
    oscHarmonic.connect(harmonicGain);
    harmonicGain.connect(masterGain);

    masterGain.connect(analyser);
    if (audibleTone) {
      analyser.connect(ctx.destination);
    }

    oscPrimary.start();
    oscHarmonic.start();
    lfo.start();

    this.audioCtx = ctx;
    this.analyser = analyser;
    this.activeNodes.push(oscPrimary, oscHarmonic, harmonicGain, lfo, lfoGain, masterGain, analyser);
  }

  public stopAcousticMonitor(): void {
    this.activeNodes.forEach((node) => {
      if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
        try {
          (node as OscillatorNode).stop();
        } catch {
          // Ignore already stopped oscillators
        }
      }
      try {
        node.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    });
    this.activeNodes = [];
    this.analyser = null;

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  public isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public speakTranscript(
    segments: TranscriptSegment[],
    onSegmentStart: (segmentId: string | null) => void,
    onComplete: () => void,
  ): void {
    this.stopSpeech();
    if (!this.isSpeechSupported() || segments.length === 0) {
      onComplete();
      return;
    }

    this.speechCancelled = false;
    let index = 0;

    const speakNext = () => {
      if (this.speechCancelled || index >= segments.length) {
        onSegmentStart(null);
        onComplete();
        return;
      }

      const seg = segments[index];
      index += 1;
      onSegmentStart(seg.id);

      const utterance = new SpeechSynthesisUtterance(seg.text);
      utterance.rate = seg.speaker === 'CALLER' ? 1.03 : 0.98;
      utterance.pitch = seg.speaker === 'CALLER' ? 0.92 : 1.08;
      utterance.onend = () => speakNext();
      utterance.onerror = () => speakNext();

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }

  public speakBotPrompt(
    text: string,
    onStart: () => void,
    onEnd: () => void,
  ): boolean {
    this.interruptBotImmediately();
    onStart();
    if (!this.isSpeechSupported()) {
      // If speechSynthesis is unavailable, keep speaking state briefly only when caller explicitly runs UI demo
      return false;
    }

    this.speechCancelled = false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.pitch = 1.04;
    utterance.onend = () => {
      if (!this.speechCancelled) onEnd();
    };
    utterance.onerror = () => {
      if (!this.speechCancelled) onEnd();
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  public interruptBotImmediately(): void {
    this.speechCancelled = true;
    if (this.isSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  public stopSpeech(): void {
    this.speechCancelled = true;
    if (this.isSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}

export const callAudioController = new CallAudioController();
