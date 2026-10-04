/**
 * Immutable undo/redo history. Consecutive edits with the same `mergeKey`
 * (e.g. dragging one slider) collapse into a single undo step so that one
 * Ctrl+Z undoes the whole drag, not every pixel of it.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastMergeKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 200;
const MERGE_WINDOW_MS = 800;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastMergeKey: null, lastAt: 0 };
}

export function push<T>(h: History<T>, next: T, mergeKey: string | null = null, now = Date.now()): History<T> {
  if (Object.is(next, h.present)) return h;
  const merge = mergeKey !== null && mergeKey === h.lastMergeKey && now - h.lastAt < MERGE_WINDOW_MS;
  if (merge) {
    return { ...h, present: next, future: [], lastAt: now };
  }
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: next, future: [], lastMergeKey: mergeKey, lastAt: now };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future], lastMergeKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest, lastMergeKey: null, lastAt: 0 };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;
