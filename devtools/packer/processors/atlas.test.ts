import { describe, expect, it } from 'vitest';

import type { ExtractedSprite } from '../types.ts';
import { Atlas } from './atlas.ts';

/** A tiny fully-opaque RGBA sprite so the trimmer keeps a 2x2 content box. */
function sprite(name: string, frameIndex: number): ExtractedSprite {
  const data = new Uint8Array(2 * 2 * 4).fill(255);
  return { index: 0, name, path: '', width: 2, height: 2, x: 0, y: 0, data, frameIndex };
}

describe('Atlas.metadata — Aseprite animation meta', () => {
  it('emits meta.frameTags and per-frame durations, and keeps the whole-layer animation', async () => {
    const atlas = new Atlas();
    atlas.addSprites([sprite('hero', 0), sprite('hero', 1)]);
    atlas.setAnimationMeta({
      tags: [{ name: 'idle', from: 0, to: 1, animDirection: 'Ping-pong', repeat: 0, color: '000000' }],
      frameDurations: [120, 80],
    });

    await atlas.buffer();
    const meta = atlas.metadata('hero.png');

    // Whole-layer animation is still emitted (Godot + Pixi both consume it).
    expect(meta.animations?.hero).toEqual(['hero#0', 'hero#1']);

    // Standard Aseprite frameTags block, direction lower-cased.
    expect(meta.meta.frameTags).toEqual([{ name: 'idle', from: 0, to: 1, direction: 'pingpong' }]);

    // Per-frame durations land on each frame, keyed by real frame index.
    expect(meta.frames['hero#0'].duration).toBe(120);
    expect(meta.frames['hero#1'].duration).toBe(80);
  });

  it('emits an empty frameTags array when the source has no tags', async () => {
    const atlas = new Atlas();
    atlas.addSprites([sprite('block', 0)]);
    atlas.setAnimationMeta({ tags: [], frameDurations: [100] });

    await atlas.buffer();
    const meta = atlas.metadata('block.png');

    expect(meta.meta.frameTags).toEqual([]);
    expect(meta.frames['block#0'].duration).toBe(100);
  });
});
