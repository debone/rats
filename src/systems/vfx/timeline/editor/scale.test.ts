import { describe, expect, it } from 'vitest';

import type { Track } from '../types';
import { chooseTickStep, fitScale, snapTime, tickTimes, valueAtTime } from './scale';

describe('chooseTickStep', () => {
  it('picks finer steps as zoom increases', () => {
    // 9px/frame, 64px min gap → first step where step*9 >= 64 is 10.
    expect(chooseTickStep(9)).toBe(10);
    // 20px/frame → 5*20 = 100px >= 64 → 5.
    expect(chooseTickStep(20)).toBe(5);
    // 64px/frame → 1 frame fits → finest step.
    expect(chooseTickStep(64)).toBe(1);
    // very zoomed out → coarse.
    expect(chooseTickStep(0.001)).toBe(3000);
  });

  it('honors a custom minimum gap', () => {
    expect(chooseTickStep(9, 40)).toBe(5);
  });
});

describe('tickTimes', () => {
  it('spans 0..duration inclusive at the chosen step', () => {
    const ticks = tickTimes(50, 9); // step 10
    expect(ticks[0]).toBe(0);
    expect(ticks).toContain(50);
    expect(ticks.every((t, i) => i === 0 || t > ticks[i - 1])).toBe(true);
  });
});

describe('fitScale', () => {
  it('spreads the duration across the viewport', () => {
    expect(fitScale(800, 1600)).toBe(0.5);
  });
  it('degrades safely on zero inputs', () => {
    expect(fitScale(0, 1000)).toBe(1);
    expect(fitScale(800, 0)).toBe(1);
  });
});

describe('snapTime', () => {
  it('rounds to the grid', () => {
    expect(snapTime(123, { grid: 10 })).toBe(120);
    expect(snapTime(126, { grid: 10 })).toBe(130);
  });
  it('prefers a nearby target over the grid result', () => {
    expect(snapTime(148, { grid: 10, targets: [150], thresholdMs: 5 })).toBe(150);
  });
  it('ignores targets outside the threshold', () => {
    expect(snapTime(120, { grid: 10, targets: [150], thresholdMs: 5 })).toBe(120);
  });
  it('passes through unsnapped when no options given', () => {
    expect(snapTime(123.6)).toBe(124);
  });
});

describe('valueAtTime', () => {
  const track: Track = {
    actor: 'a',
    property: 'alpha',
    keys: [
      { time: 0, value: 0 },
      { time: 100, value: 1 },
      { time: 200, value: 0 },
    ],
  };

  it('linear-interpolates between numeric keys', () => {
    expect(valueAtTime(track, 50)).toBeCloseTo(0.5);
    expect(valueAtTime(track, 150)).toBeCloseTo(0.5);
  });
  it('clamps to the endpoints', () => {
    expect(valueAtTime(track, -10)).toBe(0);
    expect(valueAtTime(track, 999)).toBe(0);
  });
  it('returns the nearest value for string tracks', () => {
    const tint: Track = {
      actor: 'a',
      property: 'tint',
      keys: [
        { time: 0, value: '#fff' },
        { time: 100, value: '#000' },
      ],
    };
    expect(valueAtTime(tint, 40)).toBe('#fff');
  });
  it('returns null for an empty track', () => {
    expect(valueAtTime({ actor: 'a', property: 'x', keys: [] }, 0)).toBeNull();
  });
  it('follows the later key easing (so an inserted key sits on the curve)', () => {
    // 'out' (outQuad) at p=0.5 is 0.75, not the linear 0.5.
    const eased: Track = {
      actor: 'a',
      property: 'alpha',
      keys: [
        { time: 0, value: 0 },
        { time: 100, value: 1, ease: 'out' },
      ],
    };
    expect(valueAtTime(eased, 50)).toBeCloseTo(0.75);
  });
});
