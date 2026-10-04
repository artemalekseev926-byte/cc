export interface Spectrum {
  readonly live: boolean;
  bands(count: number, out?: Float32Array): Float32Array;
  bass(): number;
  level(): number;
}

class SystemAudio implements Spectrum {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private data = new Uint8Array(1024);
  private users = 0;
  private starting: Promise<void> | null = null;
  live = false;

  async acquire(): Promise<void> {
    this.users++;
    if (this.users === 1) this.starting = this.start();
    await this.starting;
  }

  release(): void {
    this.users = Math.max(0, this.users - 1);
    if (this.users === 0) this.stop();
  }

  private async start(): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) return;
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { width: 1, height: 1, frameRate: 1 } });
      stream.getVideoTracks().forEach((t) => t.stop());
      if (stream.getAudioTracks().length === 0 || this.users === 0) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      context.createMediaStreamSource(stream).connect(analyser);
      this.context = context;
      this.analyser = analyser;
      this.stream = stream;
      this.data = new Uint8Array(analyser.frequencyBinCount);
      this.live = true;
    } catch {
      this.live = false;
    }
  }

  private stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.context?.close().catch(() => undefined);
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.live = false;
  }

  private sample(): Uint8Array | null {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.data);
    return this.data;
  }

  bands(count: number, out = new Float32Array(count)): Float32Array {
    const data = this.sample();
    if (!data) return idleBands(count, out);
    const usable = Math.floor(data.length * 0.75);
    for (let i = 0; i < count; i++) {
      const from = Math.floor(Math.pow(i / count, 2) * usable);
      const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / count, 2) * usable));
      let peak = 0;
      for (let j = from; j < to; j++) if (data[j] > peak) peak = data[j];
      out[i] = peak / 255;
    }
    return out;
  }

  bass(): number {
    const data = this.sample();
    if (!data) return 0;
    let sum = 0;
    const n = 8;
    for (let i = 1; i <= n; i++) sum += data[i];
    return sum / (n * 255);
  }

  level(): number {
    const data = this.sample();
    if (!data) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / (data.length * 255);
  }
}

function idleBands(count: number, out: Float32Array): Float32Array {
  const t = performance.now() / 1000;
  for (let i = 0; i < count; i++) out[i] = 0.08 + 0.06 * (1 + Math.sin(t * 1.6 + i * 0.35)) * (1 - i / (count * 1.4));
  return out;
}

export const systemAudio = new SystemAudio();
