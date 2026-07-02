import { describe, expect, it } from 'vitest';

import { collectAnimations } from './typescript.ts';

describe('collectAnimations', () => {
  it('collects whole-layer animations with per-frame durations', () => {
    const clips = collectAnimations({
      frames: { 'tiles#0': { duration: 100 }, 'tiles#1': { duration: 150 } },
      animations: { tiles: ['tiles#0', 'tiles#1'] },
      meta: { frameTags: [] },
    });

    expect(clips.tiles).toEqual({
      name: 'tiles',
      frames: ['tiles#0', 'tiles#1'],
      durations: [100, 150],
      direction: 'forward',
    });
  });

  it('emits a tag-scoped clip per multi-frame layer', () => {
    const clips = collectAnimations({
      frames: {
        'hero#0': { duration: 100 },
        'hero#1': { duration: 100 },
        'hero#2': { duration: 100 },
        'hero#3': { duration: 100 },
      },
      animations: { hero: ['hero#0', 'hero#1', 'hero#2', 'hero#3'] },
      meta: {
        frameTags: [
          { name: 'idle', from: 0, to: 1, direction: 'forward' },
          { name: 'walk', from: 2, to: 3, direction: 'pingpong' },
        ],
      },
    });

    // Whole-layer + one clip per tag.
    expect(clips.hero.name).toBe('hero');
    expect(clips.hero_idle).toEqual({
      name: 'hero:idle',
      frames: ['hero#0', 'hero#1'],
      durations: [100, 100],
      direction: 'forward',
    });
    expect(clips.hero_walk).toEqual({
      name: 'hero:walk',
      frames: ['hero#2', 'hero#3'],
      durations: [100, 100],
      direction: 'pingpong',
    });
  });

  it('skips a tag range whose frames do not all exist', () => {
    const clips = collectAnimations({
      frames: { 'hero#0': { duration: 100 }, 'hero#1': { duration: 100 } },
      animations: { hero: ['hero#0', 'hero#1'] },
      meta: { frameTags: [{ name: 'run', from: 0, to: 5, direction: 'forward' }] },
    });

    // 'run' would need hero#0..hero#5, but only #0/#1 exist → not emitted.
    expect(clips.hero_run).toBeUndefined();
    expect(clips.hero).toBeDefined();
  });

  it('returns nothing for a single-frame atlas with no animations', () => {
    const clips = collectAnimations({
      frames: { 'block#0': {} },
      animations: {},
      meta: { frameTags: [] },
    });
    expect(Object.keys(clips)).toHaveLength(0);
  });
});
