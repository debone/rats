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

    expect(tl.add.mock.calls).toEqual([[box, { alpha: [0, 1], duration: framesToMs(50), ease: 'out' }, framesToMs(0)]]);
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

    expect(tl.add.mock.calls).toEqual([[scale, { x: [0, 1], duration: framesToMs(10) }, framesToMs(0)]]);
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
    const segments = tl.add.mock.calls.map((c) => (c[1] as { alpha: unknown }).alpha);
    expect(segments).toEqual([
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
  });

  it('seeds at t=0 when the first key is after frame 0 (pre-roll scrub)', () => {
    const tl = makeTl();
    const box = { alpha: 0.9 };
    const doc: TimelineDoc = {
      id: 't',
      duration: 100,
      tracks: [
        {
          actor: 'box',
          property: 'alpha',
          keys: [
            { time: 5, value: 0 },
            { time: 100, value: 1 },
          ],
        },
      ],
      cues: [],
    };

    compile(doc, { box }, {}, tl);

    expect(tl.add.mock.calls).toEqual([
      [box, { alpha: 0, duration: 0 }, 0],
      [box, { alpha: [0, 1], duration: framesToMs(95) }, framesToMs(5)],
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

  it('maps the `frame` property onto an AnimatedSprite currentFrame (scrubbable frame track)', () => {
    const tl = makeTl();
    const sprite = { currentFrame: 0 };
    const doc: TimelineDoc = {
      id: 't',
      duration: 4,
      tracks: [
        {
          actor: 'spr',
          property: 'frame',
          keys: [
            { time: 0, value: 0 },
            { time: 4, value: 3 },
          ],
        },
      ],
      cues: [],
    };

    compile(doc, { spr: sprite }, {}, tl);

    // `frame` compiles onto `currentFrame`; the playhead drives the frame index.
    expect(tl.add.mock.calls[0]).toEqual([sprite, { currentFrame: [0, 3], duration: framesToMs(4) }, framesToMs(0)]);
  });

  it('compiles each cue key into a tl.call that fires the hook with (tl, key)', () => {
    const tl = makeTl();
    const boom = vi.fn();
    const doc: TimelineDoc = {
      id: 't',
      duration: 10,
      tracks: [],
      cues: [{ hook: 'boom', keys: [{ time: 5, value: 2 }, { time: 8 }] }],
    };

    compile(doc, {}, { boom }, tl);

    // Two cue beats fire at their positions (a terminal duration anchor is also added).
    const positions = tl.call.mock.calls.map((c) => c[1]);
    expect(positions).toContain(framesToMs(5));
    expect(positions).toContain(framesToMs(8));

    // The wrapped closures fire the hook with (tl, key); the key carries the value.
    (tl.call.mock.calls[0][0] as () => void)();
    (tl.call.mock.calls[1][0] as () => void)();
    expect(boom.mock.calls.map((c) => (c[1] as { value?: number }).value)).toEqual([2, undefined]);
  });

  it('skips (and warns about) unknown actors and hooks instead of throwing', () => {
    const tl = makeTl();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // duration 0 → no terminal anchor call, so tl.call reflects only cues.
    const doc: TimelineDoc = {
      id: 't',
      duration: 0,
      tracks: [{ actor: 'missing', property: 'x', keys: [{ time: 0, value: 1 }] }],
      cues: [{ hook: 'missing', keys: [{ time: 0 }] }],
    };

    expect(() => compile(doc, {}, {}, tl)).not.toThrow();
    expect(tl.add).not.toHaveBeenCalled();
    expect(tl.call).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
