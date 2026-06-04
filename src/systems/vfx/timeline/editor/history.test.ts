import { describe, expect, it } from 'vitest';

import type { TimelineDoc } from '../types';
import { DocHistory } from './history';

const doc = (duration: number): TimelineDoc => ({ id: 'seq', duration, tracks: [], cues: [] });

describe('DocHistory', () => {
  it('starts empty', () => {
    const h = new DocHistory();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo(doc(1))).toBeNull();
    expect(h.redo(doc(1))).toBeNull();
  });

  it('undoes to the recorded snapshot and redoes back', () => {
    const h = new DocHistory();
    const v1 = doc(1);
    h.record(v1); // about to mutate v1 → v2
    const v2 = doc(2);
    expect(h.canUndo).toBe(true);

    const undone = h.undo(v2);
    expect(undone?.duration).toBe(1);
    expect(h.canRedo).toBe(true);

    const redone = h.redo(undone!);
    expect(redone?.duration).toBe(2);
  });

  it('snapshots are decoupled from later mutation (deep clone)', () => {
    const h = new DocHistory();
    const v = doc(1);
    h.record(v);
    v.duration = 999; // mutate after recording
    expect(h.undo(doc(2))?.duration).toBe(1);
  });

  it('a fresh record clears the redo stack', () => {
    const h = new DocHistory();
    h.record(doc(1));
    h.undo(doc(2));
    expect(h.canRedo).toBe(true);
    h.record(doc(3));
    expect(h.canRedo).toBe(false);
  });

  it('clear empties both stacks', () => {
    const h = new DocHistory();
    h.record(doc(1));
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});
