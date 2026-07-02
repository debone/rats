import { describe, expect, it } from 'vitest';

import type { Spritesheet, Texture } from 'pixi.js';
import { type AnimationClip, orderedFrames, resolveAnimationClip, type TimedFrame } from './animatedSprite';

/** A stand-in Texture — resolveAnimationClip only stores the reference. */
function tex(id: string): Texture {
  return { id } as unknown as Texture;
}

/** Build a minimal Spritesheet-like object exposing `.textures` and `.data`. */
function fakeSheet(opts: {
  frames: Record<string, { duration?: number }>;
  animations?: Record<string, string[]>;
  frameTags?: { name: string; from: number; to: number; direction?: string }[];
}): Spritesheet {
  const textures: Record<string, Texture> = {};
  for (const name of Object.keys(opts.frames)) textures[name] = tex(name);
  return {
    textures,
    data: {
      frames: opts.frames,
      animations: opts.animations,
      meta: { frameTags: opts.frameTags },
    },
  } as unknown as Spritesheet;
}

describe('resolveAnimationClip', () => {
  it('resolves a whole-layer animation with per-frame durations', () => {
    const sheet = fakeSheet({
      frames: { 'rat#0': { duration: 120 }, 'rat#1': { duration: 80 } },
      animations: { rat: ['rat#0', 'rat#1'] },
    });

    const clip = resolveAnimationClip(sheet, 'rat');
    expect(clip).not.toBeNull();
    expect(clip!.direction).toBe('forward');
    expect(clip!.frames.map((f) => f.time)).toEqual([120, 80]);
    expect((clip!.frames[0].texture as unknown as { id: string }).id).toBe('rat#0');
  });

  it('resolves a tag-scoped animation from meta.frameTags', () => {
    const sheet = fakeSheet({
      frames: {
        'rat#0': { duration: 100 },
        'rat#1': { duration: 100 },
        'rat#2': { duration: 100 },
        'rat#3': { duration: 100 },
      },
      frameTags: [{ name: 'walk', from: 1, to: 2, direction: 'pingpong' }],
    });

    const clip = resolveAnimationClip(sheet, 'rat:walk');
    expect(clip).not.toBeNull();
    expect(clip!.direction).toBe('pingpong');
    expect(clip!.frames.map((f) => (f.texture as unknown as { id: string }).id)).toEqual(['rat#1', 'rat#2']);
  });

  it('falls back to a default duration when a frame carries none', () => {
    const sheet = fakeSheet({
      frames: { 'rat#0': {}, 'rat#1': {} },
      animations: { rat: ['rat#0', 'rat#1'] },
    });
    const clip = resolveAnimationClip(sheet, 'rat')!;
    expect(clip.frames.map((f) => f.time)).toEqual([100, 100]);
  });

  it('returns null for an unknown animation or tag', () => {
    const sheet = fakeSheet({ frames: { 'rat#0': {} }, animations: { rat: ['rat#0'] } });
    expect(resolveAnimationClip(sheet, 'nope')).toBeNull();
    expect(resolveAnimationClip(sheet, 'rat:missing')).toBeNull();
  });

  it('returns null when a referenced frame texture is absent', () => {
    const sheet = fakeSheet({ frames: { 'rat#0': {} }, animations: { rat: ['rat#0', 'rat#1'] } });
    // 'rat#1' is in the animation list but has no texture entry.
    expect(resolveAnimationClip(sheet, 'rat')).toBeNull();
  });
});

describe('orderedFrames', () => {
  const frames: TimedFrame[] = [0, 1, 2, 3].map((i) => ({ texture: tex(`f${i}`), time: 100 }));
  const ids = (fs: TimedFrame[]) => fs.map((f) => (f.texture as unknown as { id: string }).id);

  it('keeps forward order', () => {
    expect(ids(orderedFrames({ frames, direction: 'forward' }))).toEqual(['f0', 'f1', 'f2', 'f3']);
  });

  it('reverses', () => {
    expect(ids(orderedFrames({ frames, direction: 'reverse' }))).toEqual(['f3', 'f2', 'f1', 'f0']);
  });

  it('ping-pongs without repeating endpoints', () => {
    expect(ids(orderedFrames({ frames, direction: 'pingpong' }))).toEqual(['f0', 'f1', 'f2', 'f3', 'f2', 'f1']);
  });

  it('ping-pong-reverses', () => {
    expect(ids(orderedFrames({ frames, direction: 'pingpong_reverse' }))).toEqual(['f3', 'f2', 'f1', 'f0', 'f1', 'f2']);
  });

  it('does not duplicate a 2-frame ping-pong', () => {
    const two: TimedFrame[] = [
      { texture: tex('a'), time: 1 },
      { texture: tex('b'), time: 1 },
    ];
    expect(ids(orderedFrames({ frames: two, direction: 'pingpong' } as AnimationClip))).toEqual(['a', 'b']);
  });
});
