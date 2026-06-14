import { describe, expect, it } from 'vitest';

import { migrateDoc } from './migrate';
import type { TimelineDoc } from './types';

describe('migrateDoc', () => {
  it('groups legacy flat cues into per-hook tracks, sorted, carrying values', () => {
    // Old schema: a flat list of {time, hook} beats, multiple hooks intermixed.
    const doc = {
      id: 't',
      duration: 100,
      tracks: [],
      cues: [
        { time: 50, hook: 'burst' },
        { time: 10, hook: 'burst', value: 3 },
        { time: 20, hook: 'clink' },
      ],
    } as unknown as TimelineDoc;

    migrateDoc(doc);

    expect(doc.cues).toEqual([
      {
        hook: 'burst',
        keys: [{ time: 10, value: 3 }, { time: 50 }],
      },
      { hook: 'clink', keys: [{ time: 20 }] },
    ]);
  });

  it('leaves an already-grouped doc untouched (idempotent)', () => {
    const doc: TimelineDoc = {
      id: 't',
      duration: 100,
      tracks: [],
      cues: [{ hook: 'burst', keys: [{ time: 10, value: 2 }] }],
    };
    const before = JSON.stringify(doc);
    migrateDoc(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('normalizes a missing/invalid cues array to empty', () => {
    const doc = { id: 't', duration: 100, tracks: [] } as unknown as TimelineDoc;
    migrateDoc(doc);
    expect(doc.cues).toEqual([]);
  });
});
