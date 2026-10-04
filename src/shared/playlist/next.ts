import { isNightAt, type Playlist } from '../ipc';

export interface PlaylistClock {
  now: Date;
  lastSwitchMs: number;
  random?: () => number;
}

export function nextPlaylistTheme(p: Playlist, currentId: string | null, clock: PlaylistClock): string | null {
  if (!p.enabled) return null;
  if (p.mode === 'dayNight') {
    const target = isNightAt(clock.now.getHours(), p) ? p.nightThemeId : p.dayThemeId;
    return target && target !== currentId ? target : null;
  }
  const ids = p.themeIds;
  if (ids.length === 0) return null;
  if (currentId && ids.includes(currentId) && clock.now.getTime() - clock.lastSwitchMs < p.intervalMinutes * 60_000) return null;
  if (ids.length === 1) return ids[0] === currentId ? null : ids[0];
  if (p.shuffle) {
    const pool = ids.filter((id) => id !== currentId);
    return pool[Math.floor((clock.random ?? Math.random)() * pool.length) % pool.length];
  }
  const at = currentId ? ids.indexOf(currentId) : -1;
  return ids[(at + 1) % ids.length];
}
