import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FRAME_MS, Transport } from './Transport';

/** Minimal stand-in for an anime.js Timeline — only the surface Transport touches. */
class FakeTimeline {
  duration = 1000;
  currentTime = 0;
  completed = false;
  speed = 1;
  paused = false;
  seekCalls: Array<{ time: number; muted?: boolean }> = [];
  played = false;
  reverted = false;
  then: unknown;

  pause() {
    this.paused = true;
  }
  play() {
    this.played = true;
    this.paused = false;
  }
  seek(time: number, muted?: boolean) {
    this.currentTime = time;
    this.seekCalls.push({ time, muted });
  }
  complete() {
    this.completed = true;
    this.currentTime = this.duration;
  }
  revert() {
    this.reverted = true;
  }
}

function makeTransport() {
  const tl = new FakeTimeline();
  const transport = new Transport();
  // `track` reassigns tl.then; cast keeps the structural fake compatible.
  transport.track(tl as unknown as import('animejs').Timeline);
  return { tl, transport };
}

describe('Transport', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pauses and applies current speed when tracking a timeline', () => {
    const tl = new FakeTimeline();
    const transport = new Transport();
    transport.setSpeed(0.5);
    transport.track(tl as unknown as import('animejs').Timeline);
    expect(tl.paused).toBe(true);
    expect(tl.speed).toBe(0.5);
  });

  it('seek scrubs with callbacks muted and reports normalized progress', () => {
    const { tl, transport } = makeTransport();
    const onProgress = vi.fn();
    transport.onProgress = onProgress;

    transport.seek(0.25);

    expect(tl.seekCalls.at(-1)).toEqual({ time: 250, muted: true });
    expect(onProgress).toHaveBeenLastCalledWith(0.25);
    expect(transport.isPlaying).toBe(false);
  });

  it('step advances by whole frames, muted and clamped to [0,1]', () => {
    const { tl, transport } = makeTransport();
    transport.step(1);
    expect(tl.seekCalls.at(-1)).toEqual({ time: FRAME_MS, muted: true });

    transport.seek(1);
    transport.step(1); // already at end → clamp
    expect(tl.currentTime).toBe(tl.duration);
  });

  it('setSpeed propagates to tracked timelines', () => {
    const { tl, transport } = makeTransport();
    transport.setSpeed(2);
    expect(tl.speed).toBe(2);
    expect(transport.speed).toBe(2);
  });

  it('play restarts from 0 when parked at the end', () => {
    const { tl, transport } = makeTransport();
    transport.seek(1);
    transport.play();
    expect(tl.seekCalls.at(-1)).toEqual({ time: 0, muted: true });
    expect(tl.played).toBe(true);
    expect(transport.isPlaying).toBe(true);
  });

  it('finish completes timelines and resolves the withheld await exactly once', async () => {
    const tl = new FakeTimeline();
    const transport = new Transport();
    transport.track(tl as unknown as import('animejs').Timeline);

    // `await tl` after interception: then() returns a promise resolved by finish().
    const awaited = (tl.then as (cb?: (v: unknown) => unknown) => Promise<void>)();
    const resolved = vi.fn();
    void awaited.then(resolved);

    transport.finish();
    expect(tl.completed).toBe(true);
    await Promise.resolve();
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it('retire pauses, reverts, and drops timelines without resolving awaits', async () => {
    const tl = new FakeTimeline();
    const transport = new Transport();
    transport.track(tl as unknown as import('animejs').Timeline);
    const awaited = (tl.then as (cb?: (v: unknown) => unknown) => Promise<void>)();
    const resolved = vi.fn();
    void awaited.then(resolved);

    transport.retire();

    expect(tl.reverted).toBe(true);
    expect(tl.paused).toBe(true);
    expect(transport.duration).toBe(0); // no timelines tracked anymore
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled(); // await carries over, not resolved
  });
});
