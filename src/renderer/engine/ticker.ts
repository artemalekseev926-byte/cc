/**
 * Frame-rate-limited animation loop shared by every animated layer of a stage.
 *
 * - Honors the theme's FPS limit (most of the energy saving comes from here).
 * - Stops requesting frames entirely while paused, so a paused wallpaper costs ~0.
 * - Records frame-to-frame times for the performance report.
 */
export type TickFn = (t: number, dt: number) => void;

export class Ticker {
  private subscribers = new Set<TickFn>();
  private raf = 0;
  private last = 0;
  private lastFrame = 0;
  private start = performance.now();
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private frameTimes: number[] = [];
  private fps: number;
  private paused = false;

  constructor(fps: number) {
    this.fps = fps;
  }

  setFps(fps: number) {
    this.fps = fps;
  }

  /** Time in seconds since start, excluding paused time. */
  get time(): number {
    const now = this.pausedAt ?? performance.now();
    return (now - this.start - this.pausedTotal) / 1000;
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
      this.pausedAt = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else {
      if (this.pausedAt !== null) this.pausedTotal += performance.now() - this.pausedAt;
      this.pausedAt = null;
      this.last = 0;
      this.lastFrame = 0;
      this.ensureRunning();
    }
  }

  get isPaused() {
    return this.paused;
  }

  /** Returns and clears the frame times recorded since the last call. */
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
    // Small tolerance so 60 Hz displays reliably hit a 30 FPS limit (every 2nd vsync).
    if (this.last === 0 || now - this.last >= interval - 1.5) {
      const dt = this.last === 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.lastFrame) this.frameTimes.push(now - this.lastFrame);
      if (this.frameTimes.length > 2000) this.frameTimes.splice(0, 1000);
      this.lastFrame = now;
      const t = this.time;
      for (const fn of this.subscribers) fn(t, dt);
    }
    if (this.subscribers.size > 0) this.raf = requestAnimationFrame(this.loop);
  };
}
