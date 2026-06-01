import { describe, expect, it, vi } from 'vitest';

import { compile, type TimelineLike } from './compile';
import { framesToMs } from './time';
import type { TimelineDoc } from './types';

function makeTl(): TimelineLike & { add: ReturnType<typeof vi.fn>; call: ReturnType<typeof vi.fn> } {
  return { add: vi.fn(), call: vi.fn() };
}

describe('compile', () => {
  it('seeds the first key and emits a tween per adjacent pair (ease enters the later key), frames→ms', () => {
    const tl = makeTl();
    const box = { alpha: 0 };
    const doc: TimelineDoc = {
      id: 't',
      duration: 100,
      tracks: [
        {
          actor: 'box',
          property: 'alpha',
          keys: [
            { time: 0, value: 0 },
            { time: 50, value: 1, ease: 'out' },
          ],
        },
      ],
      cues: [],
    };

    compile(doc, { box }, {}, tl);

    expect(tl.add.mock.calls).toEqual([
      [box, { alpha: 0, duration: 1 }, 0],
      [box, { alpha: [0, 1], duration: framesToMs(50), ease: 'out' }, framesToMs(0)],
    ]);
  });

  it('resolves dotted properties to the nested target object', () => {
    const tl = makeTl();
    const scale = { x: 0 };
    const actor = { scale };
    const doc: TimelineDoc = {
      id: 't',
      duration: 10,
      tracks: [
        {
          actor: 'a',
          property: 'scale.x',
          keys: [
            { time: 0, value: 0 },
            { time: 10, value: 1 },
          ],
        },
      ],
      cues: [],
    };

    compile(doc, { a: actor }, {}, tl);

    expect(tl.add.mock.calls).toEqual([
      [scale, { x: 0, duration: 1 }, 0],
      [scale, { x: [0, 1], duration: framesToMs(10) }, framesToMs(0)],
    ]);
  });

  it('chains each segment from the previous key (no spring-from-origin / saw-wave)', () => {
    // Regression: a hold like 0→1→1→0 must ramp up, hold, then fade — every
    // segment must carry the previous value as its `from`, not the original 0.
    const tl = makeTl();
    const box = { alpha: 0 };
    const doc: TimelineDoc = {
      id: 't',
      duration: 30,
      tracks: [
        {
          actor: 'box',
          property: 'alpha',
          keys: [
            { time: 0, value: 0 },
            { time: 10, value: 1 },
            { time: 20, value: 1 },
            { time: 30, value: 0 },
          ],
        },
      ],
      cues: [],
    };

    compile(doc, { box }, {}, tl);

    // The three segment tweens carry [prev, next]: 0→1, 1→1 (flat hold), 1→0.
    const segments = tl.add.mock.calls.slice(1).map((c) => (c[1] as { alpha: unknown }).alpha);
    expect(segments).toEqual([
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
  });

  it('keeps tint values as strings so anime color-interpolates', () => {
    const tl = makeTl();
    const flash = { tint: '#000000' };
    const doc: TimelineDoc = {
      id: 't',
      duration: 1,
      tracks: [{ actor: 'flash', property: 'tint', keys: [{ time: 0, value: '#ffffff' }] }],
      cues: [],
    };

    compile(doc, { flash }, {}, tl);

    expect(tl.add.mock.calls).toEqual([[flash, { tint: '#ffffff', duration: 1 }, 0]]);
  });

  it('compiles cues into tl.call with the resolved hook', () => {
    const tl = makeTl();
    const boom = vi.fn();
    const doc: TimelineDoc = { id: 't', duration: 10, tracks: [], cues: [{ time: 5, hook: 'boom' }] };

    compile(doc, {}, { boom }, tl);

    expect(tl.call.mock.calls).toEqual([[boom, framesToMs(5)]]);
  });

  it('skips (and warns about) unknown actors and hooks instead of throwing', () => {
    const tl = makeTl();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc: TimelineDoc = {
      id: 't',
      duration: 10,
      tracks: [{ actor: 'missing', property: 'x', keys: [{ time: 0, value: 1 }] }],
      cues: [{ time: 0, hook: 'missing' }],
    };

    expect(() => compile(doc, {}, {}, tl)).not.toThrow();
    expect(tl.add).not.toHaveBeenCalled();
    expect(tl.call).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
