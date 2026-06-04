import { describe, expect, it } from 'vitest';

import type { TimelineDoc } from '../types';
import {
  addCue,
  addKey,
  addTrack,
  deleteCue,
  deleteKey,
  moveCue,
  removeTrack,
  retimeKey,
  setDuration,
  setKeyEase,
  setKeyValue,
} from './ops';

function doc(): TimelineDoc {
  return {
    id: 't',
    duration: 1000,
    tracks: [
      {
        actor: 'box',
        property: 'alpha',
        keys: [
          { time: 0, value: 0 },
          { time: 500, value: 1 },
        ],
      },
    ],
    cues: [{ time: 100, hook: 'boom' }],
  };
}

describe('timeline editor ops', () => {
  it('retimeKey clamps to [0,duration] and re-sorts keys', () => {
    const d = doc();
    retimeKey(d, 0, 0, 9999); // first key past the end → clamps, then sorts behind the 500 key
    expect(d.tracks[0].keys.map((k) => k.time)).toEqual([500, 1000]);
  });

  it('retimeKey clamps negative times to 0', () => {
    const d = doc();
    retimeKey(d, 0, 1, -50);
    expect(d.tracks[0].keys.map((k) => k.time)).toEqual([0, 0]);
  });

  it('setKeyValue and setKeyEase mutate the key; empty ease is removed', () => {
    const d = doc();
    setKeyValue(d, 0, 1, 0.5);
    setKeyEase(d, 0, 1, 'outQuad');
    expect(d.tracks[0].keys[1]).toEqual({ time: 500, value: 0.5, ease: 'outQuad' });
    setKeyEase(d, 0, 1, undefined);
    expect(d.tracks[0].keys[1].ease).toBeUndefined();
  });

  it('addKey seeds value from the track value at that time and returns its sorted index', () => {
    const d = doc();
    const idx = addKey(d, 0, 250); // between key@0(0) and key@500(1) → seeds 0 (value at/just before)
    expect(d.tracks[0].keys[idx]).toEqual({ time: 250, value: 0 });
    expect(d.tracks[0].keys.map((k) => k.time)).toEqual([0, 250, 500]);
  });

  it('addKey accepts an explicit value', () => {
    const d = doc();
    const idx = addKey(d, 0, 750, 0.9);
    expect(d.tracks[0].keys[idx]).toEqual({ time: 750, value: 0.9 });
  });

  it('deleteKey removes the key at the index', () => {
    const d = doc();
    deleteKey(d, 0, 0);
    expect(d.tracks[0].keys.map((k) => k.time)).toEqual([500]);
  });

  it('addTrack creates a new track and is idempotent per actor.property', () => {
    const d = doc();
    const i1 = addTrack(d, 'box', 'x');
    expect(d.tracks[i1]).toEqual({ actor: 'box', property: 'x', keys: [{ time: 0, value: 0 }] });
    const i2 = addTrack(d, 'box', 'x'); // already exists → returns same index, no dup
    expect(i2).toBe(i1);
    expect(d.tracks.filter((t) => t.actor === 'box' && t.property === 'x')).toHaveLength(1);
  });

  it('removeTrack drops the track', () => {
    const d = doc();
    removeTrack(d, 0);
    expect(d.tracks).toHaveLength(0);
  });

  it('setDuration pulls out-of-range keys and cues back onto the new end', () => {
    const d = doc();
    setDuration(d, 300);
    expect(d.duration).toBe(300);
    expect(d.tracks[0].keys.map((k) => k.time)).toEqual([0, 300]); // 500 → 300
    expect(d.cues[0].time).toBe(100); // unaffected
  });

  it('addCue / moveCue / deleteCue manage cues with clamping', () => {
    const d = doc();
    const idx = addCue(d, 'sparkle', 5000); // clamps to duration
    expect(d.cues[idx]).toEqual({ time: 1000, hook: 'sparkle' });
    moveCue(d, idx, 200);
    expect(d.cues[idx].time).toBe(200);
    deleteCue(d, idx);
    expect(d.cues).toHaveLength(1);
  });
});
