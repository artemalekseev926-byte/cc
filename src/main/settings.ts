import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS, SETTINGS_RANGES, type Settings } from '../shared/ipc';

export class SettingsStore {
  private value: Settings = { ...DEFAULT_SETTINGS };
  private readonly file: string;

  constructor(userDataDir: string) {
    this.file = join(userDataDir, 'settings.json');
  }

  async load(): Promise<Settings> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.value = { ...DEFAULT_SETTINGS, ...raw };
    } catch {
      this.value = { ...DEFAULT_SETTINGS };
    }
    return this.value;
  }

  get(): Settings {
    return { ...this.value };
  }

  async set(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...this.value } as Record<string, unknown>;
    for (const [key, val] of Object.entries(patch)) {
      if (!(key in DEFAULT_SETTINGS)) continue;
      const expected = typeof (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key];
      if (key === 'activeThemeId' ? val === null || typeof val === 'string' : typeof val === expected) {
        const range = SETTINGS_RANGES[key as keyof Settings];
        next[key] = range && typeof val === 'number' ? Math.min(range[1], Math.max(range[0], Number.isFinite(val) ? val : range[0])) : val;
      }
    }
    this.value = next as unknown as Settings;
    await fs.writeFile(this.file, JSON.stringify(this.value, null, 2), 'utf8');
    return this.get();
  }
}
