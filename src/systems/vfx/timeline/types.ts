import type { Timeline } from 'animejs';
import type { TimelineLike } from './compile';

/**
 * Data model for the in-engine visual timeline.
 *
 * A sequence's *timing* (the magic-number content that used to live as hand-tuned
 * `tl.add(target, props, offsetMs)` calls) is lifted out of code into a
 * serializable `TimelineDoc`. The sequence's `build()` still owns the *actors* —
 * procedural Graphics, Containers, Text, physics/camera handles — and collects
 * them into a named `Stage` map; the doc references those actors by name.
 *
 * - `Track` — per-actor, per-property keyframe envelope (position, scale, alpha,
 *   tint, rotation …). Compiled into seekable `tl.add(...)` tweens.
 * - `CueTrack` — a fire-once beat track bound to a named hook (sfx, particle burst,
 *   debris). Each of its keys fires the hook at a frame, passing the key's value to
 *   it. Compiled into `tl.call(...)`, so cues are muted while scrubbing and fire only
 *   on real playback — the same contract as a hand-authored `tl.call`. Unlike a
 *   `Track`, a cue key's value isn't interpolated (there's no envelope/graph): it's an
 *   arbitrary argument handed to the hook the instant it fires.
 */
export interface TimelineDoc {
  id: string;
  /** Authored length in **frames** — drives both the editor ruler and the playback duration. */
  duration: number;
  tracks: Track[];
  cues: CueTrack[];
}

export function emptyTimelineDoc(id: string): TimelineDoc {
  return {
    id,
    duration: 0,
    tracks: [],
    cues: [],
  };
}

/** A keyframe envelope for one property of one named actor. */
export interface Track {
  /** Name into the `Stage` map. */
  actor: string;
  /** Property path, dot-nested into the actor: `'x' | 'alpha' | 'tint' | 'scale.x'` … */
  property: string;
  keys: Key[];
}

/** A single keyframe. `ease` is the curve used to *enter* this key from the previous one. */
export interface Key {
  /** Time in **frames** (see `time.ts`). */
  time: number;
  /** Numbers lerp linearly; `tint` keys carry hex strings (e.g. `'#ffd23f'`) so anime color-interpolates. */
  value: number | string;
  ease?: string;
}

/**
 * A fire-once beat track: every key invokes the named `hook`, the same way a `Track`
 * groups an actor/property's keys. One track per hook, so each cue gets its own lane.
 */
export interface CueTrack {
  /** Name into the `Hooks` map. */
  hook: string;
  keys: CueKey[];
}

/**
 * A single cue keyframe: at `time` (in **frames**) fire the hook, passing `value` as
 * its argument. `value` is arbitrary and uninterpolated — set by hand in the editor
 * (number or string), and `undefined` when the hook takes no argument.
 */
export interface CueKey {
  time: number;
  value?: number | string;
}

/**
 * Named actors a doc's tracks resolve against — the live objects created in
 * `build()` (procedural Graphics/Containers/Text, plus `camera`/`physics`).
 * Values are intentionally untyped: the compiler resolves dotted properties
 * against them at runtime.
 */
export type Stage = Record<string, unknown>;

/**
 * Named fire-once closures a doc's cues resolve against (sfx, particle bursts, debris).
 * Each hook receives the firing cue key's `value` (a number/string the author sets in
 * the editor); hooks that take no argument simply ignore it.
 */
export type Hooks = Record<string, (tl: TimelineLike, key: CueKey) => void>;
