import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, push, redo, undo } from '../src/shared/editor/history';

describe('undo history', () => {
  it('undoes and redoes', () => {
    let h = createHistory(1);
    h = push(h, 2, null, 0);
    h = push(h, 3, null, 10_000);
    expect(h.present).toBe(3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = redo(h);
    expect(h.present).toBe(3);
    expect(canRedo(h)).toBe(false);
  });

  it('merges rapid edits with the same key into one step', () => {
    let h = createHistory(0);
    h = push(h, 1, 'slider', 1000);
    h = push(h, 2, 'slider', 1100);
    h = push(h, 3, 'slider', 1200);
    expect(h.past).toEqual([0]);
    h = undo(h);
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
  });

  it('does not merge after the merge window or with different keys', () => {
    let h = createHistory(0);
    h = push(h, 1, 'a', 1000);
    h = push(h, 2, 'a', 5000);
    h = push(h, 3, 'b', 5100);
    expect(h.past).toEqual([0, 1, 2]);
  });

  it('a new edit clears the redo stack', () => {
    let h = push(push(createHistory('a'), 'b', null, 0), 'c', null, 5000);
    h = undo(h);
    h = push(h, 'x', null, 10_000);
    expect(h.future).toEqual([]);
    expect(h.past).toEqual(['a', 'b']);
  });
});
