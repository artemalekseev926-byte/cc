import { nextPlaylistTheme } from '../shared/playlist/next';
import type { SettingsStore } from './settings';

const TICK_MS = 20_000;

export class PlaylistScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastSwitchMs = Date.now();
  private busy = false;

  constructor(
    private readonly settings: SettingsStore,
    private readonly deps: { running: () => boolean; currentId: () => string | null; apply: (id: string) => Promise<boolean> },
  ) {}

  start(): void {
    if (!this.timer) this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  noteManualSwitch(): void {
    this.lastSwitchMs = Date.now();
  }

  private async forget(id: string): Promise<void> {
    const p = this.settings.get().playlist;
    await this.settings.set({
      playlist: {
        ...p,
        themeIds: p.themeIds.filter((x) => x !== id),
        dayThemeId: p.dayThemeId === id ? null : p.dayThemeId,
        nightThemeId: p.nightThemeId === id ? null : p.nightThemeId,
      },
    });
  }

  async tick(): Promise<void> {
    if (this.busy || !this.deps.running()) return;
    const playlist = this.settings.get().playlist;
    const next = nextPlaylistTheme(playlist, this.deps.currentId(), { now: new Date(), lastSwitchMs: this.lastSwitchMs });
    if (!next) return;
    this.busy = true;
    try {
      if (await this.deps.apply(next)) this.lastSwitchMs = Date.now();
      else await this.forget(next);
    } finally {
      this.busy = false;
    }
  }
}
