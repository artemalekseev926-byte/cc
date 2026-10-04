export type TickFn = (t: number, dt: number) => void;

export class Ticker {
  private subscribers = new Set<TickFn>();
  private raf = 0;
  private last = 0;
  private lastFrame = 0;
  private elapsed = 0;
  private frameTimes: number[] = [];
  private fps: number;
  private scale = 1;
  private paused = false;

  constructor(fps: number) {
    this.fps = fps;
  }

  setFps(fps: number) {
    this.fps = fps;
  }

  setTimeScale(scale: number) {
    this.scale = Math.max(0, Math.min(4, scale));
  }

  get time(): number {
    return this.elapsed;
  }

  subscribe(fn: TickFn): () => void {
    this.subscribers.add(fn);
    this.ensureRunning();
    return () => {
      this.subscribers.delete(fn);
    };
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else {
      this.last = 0;
      this.lastFrame = 0;
      this.ensureRunning();
    }
  }

  get isPaused() {
    return this.paused;
  }

  drainFrameTimes(): number[] {
    const out = this.frameTimes;
    this.frameTimes = [];
    return out;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.subscribers.clear();
  }

  private ensureRunning() {
    if (this.raf || this.paused) return;
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.paused) return;
    const interval = 1000 / this.fps;
    if (this.last === 0 || now - this.last >= interval - 1.5) {
      const realDt = this.last === 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
      const dt = realDt * this.scale;
      this.elapsed += dt;
      this.last = now;
      if (this.lastFrame) this.frameTimes.push(now - this.lastFrame);
      if (this.frameTimes.length > 2000) this.frameTimes.splice(0, 1000);
      this.lastFrame = now;
      for (const fn of this.subscribers) fn(this.elapsed, dt);
    }
    if (this.subscribers.size > 0) this.raf = requestAnimationFrame(this.loop);
  };
}
