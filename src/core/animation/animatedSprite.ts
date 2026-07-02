/**
 * Shared helper for building Pixi `AnimatedSprite`s from the atlases the asset
 * pipeline emits.
 *
 * The Aseprite packer writes a Pixi-native spritesheet: `animations` (one entry
 * per multi-frame layer), a standard `meta.frameTags` block (Aseprite's named
 * animations — "walk", "idle" — as `{ name, from, to, direction }`), and a
 * per-frame `duration` (ms). Pixi keeps all of that on `spritesheet.data`, so an
 * animation can be resolved to its ordered frame textures + timing at runtime
 * with no extra loading.
 *
 * Two animation-name forms are understood:
 *  - `"<layer>"` — the whole-layer animation (from `data.animations`).
 *  - `"<layer>:<tag>"` — a tag-scoped slice of a layer's frames (from
 *    `data.meta.frameTags`), e.g. `"rat:walk"`.
 */

import { AnimatedSprite, Assets, type Spritesheet, type Texture } from 'pixi.js';

/** Aseprite playback direction, lower-cased in the atlas `meta.frameTags`. */
export type AnimationDirection = 'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse';

/** A frame + how long (ms) to hold it — the shape Pixi's `AnimatedSprite` takes. */
export interface TimedFrame {
  texture: Texture;
  time: number;
}

export interface AnimationClip {
  frames: TimedFrame[];
  direction: AnimationDirection;
}

export interface CreateAnimatedSpriteOptions {
  /** Loop the animation. Default `true`. */
  loop?: boolean;
  /** Start playing immediately. Default `true`. */
  autoplay?: boolean;
  /**
   * Advance frames from Pixi's shared ticker. Default `true`. Set `false` when an
   * external clock (e.g. a VFX timeline) drives `currentFrame` — see the frame
   * track in the timeline compiler.
   */
  autoUpdate?: boolean;
  /** Playback-speed multiplier applied on top of the authored per-frame timing. Default `1`. */
  speed?: number;
  /** Anchor point. Default `0.5` (centre), matching most entity sprites. */
  anchor?: number;
}

/** Fallback per-frame duration (ms) when a frame carries none — Aseprite's own default. */
const DEFAULT_FRAME_MS = 100;

/** Minimal structural view of the parts of `spritesheet.data` we read. */
interface SheetData {
  frames: Record<string, { duration?: number } | undefined>;
  animations?: Record<string, string[]>;
  meta?: { frameTags?: { name: string; from: number; to: number; direction?: string }[] };
}

function normalizeDirection(direction: string | undefined): AnimationDirection {
  switch (direction) {
    case 'reverse':
      return 'reverse';
    case 'pingpong':
      return 'pingpong';
    case 'pingpong_reverse':
      return 'pingpong_reverse';
    default:
      return 'forward';
  }
}

/**
 * Resolve an animation name against a loaded spritesheet to its ordered frame
 * textures + per-frame timing + direction. Returns `null` when the name (or its
 * frames) can't be found.
 */
export function resolveAnimationClip(sheet: Spritesheet, name: string): AnimationClip | null {
  const data = sheet.data as unknown as SheetData;

  let frameNames: string[] | undefined;
  let direction: AnimationDirection = 'forward';

  const colon = name.indexOf(':');
  if (colon >= 0) {
    // Tag-scoped: "<layer>:<tag>" → slice the layer's frames by the tag range.
    const layer = name.slice(0, colon);
    const tagName = name.slice(colon + 1);
    const tag = data.meta?.frameTags?.find((t) => t.name === tagName);
    if (!tag) return null;
    direction = normalizeDirection(tag.direction);
    frameNames = [];
    for (let i = tag.from; i <= tag.to; i++) frameNames.push(`${layer}#${i}`);
  } else {
    // Whole-layer animation.
    frameNames = data.animations?.[name];
  }

  if (!frameNames || frameNames.length === 0) return null;

  const frames: TimedFrame[] = [];
  for (const frameName of frameNames) {
    const texture = sheet.textures[frameName];
    if (!texture) return null;
    frames.push({ texture, time: data.frames[frameName]?.duration ?? DEFAULT_FRAME_MS });
  }

  return { frames, direction };
}

/**
 * Reorder a clip's frames for its playback direction. Pixi's `AnimatedSprite`
 * only plays forward + loops, so reverse/ping-pong are baked into the frame list.
 */
export function orderedFrames(clip: AnimationClip): TimedFrame[] {
  const { frames, direction } = clip;
  switch (direction) {
    case 'reverse':
      return [...frames].reverse();
    case 'pingpong': {
      if (frames.length <= 2) return frames;
      // [0,1,2] → [0,1,2,1]; the endpoints aren't repeated on the way back.
      const back = frames.slice(1, -1).reverse();
      return [...frames, ...back];
    }
    case 'pingpong_reverse': {
      const reversed = [...frames].reverse();
      if (reversed.length <= 2) return reversed;
      const back = reversed.slice(1, -1).reverse();
      return [...reversed, ...back];
    }
    case 'forward':
    default:
      return frames;
  }
}

/**
 * Build a Pixi `AnimatedSprite` for an animation in a loaded atlas.
 *
 * `atlas` is the asset alias (as passed to `Assets.get`); `name` is either a
 * layer name or a `"<layer>:<tag>"` tag animation. Per-frame Aseprite durations
 * and direction are honoured. Returns `null` if the atlas or animation is missing
 * (callers can fall back to a static `Sprite`).
 */
export function createAnimatedSprite(
  atlas: string,
  name: string,
  options: CreateAnimatedSpriteOptions = {},
): AnimatedSprite | null {
  const sheet = Assets.get<Spritesheet>(atlas);
  if (!sheet) return null;
  const clip = resolveAnimationClip(sheet, name);
  if (!clip) return null;
  return animatedSpriteFromClip(clip, options);
}

/**
 * A fire-once VFX-timeline cue hook that (re)starts an `AnimatedSprite`. Pair it
 * with an `autoUpdate: true` actor for the "trigger an animation at a beat" model
 * (as opposed to the scrubbable `frame` track). The cue key's numeric `value`, if
 * given, is the frame to start from.
 *
 * Structurally matches the timeline `Hooks` signature `(tl, key) => void` without
 * depending on the timeline types.
 */
export function playAnimationHook(sprite: AnimatedSprite): (tl: unknown, key: { value?: number | string }) => void {
  return (_tl, key) => {
    sprite.gotoAndPlay(typeof key.value === 'number' ? key.value : 0);
  };
}

/** Build an `AnimatedSprite` from an already-resolved clip. */
export function animatedSpriteFromClip(clip: AnimationClip, options: CreateAnimatedSpriteOptions = {}): AnimatedSprite {
  const { loop = true, autoplay = true, autoUpdate = true, speed = 1, anchor = 0.5 } = options;

  const ordered = orderedFrames(clip);
  const sprite = new AnimatedSprite(
    ordered.map((f) => ({ texture: f.texture, time: f.time })),
    autoUpdate,
  );
  sprite.loop = loop;
  sprite.animationSpeed = speed;
  sprite.anchor.set(anchor);
  if (autoplay) sprite.play();
  return sprite;
}
