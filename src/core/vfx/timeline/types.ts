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
 * - `Cue` — a fire-once beat (sfx, particle burst, debris) bound to a named hook.
 *   Compiled into `tl.call(...)`, so it's muted while scrubbing and fires only on
 *   real playback — the same contract as a hand-authored `tl.call`.
 */
export interface TimelineDoc {
  id: string;
  /** Authored length in **frames** — drives the editor ruler. Playback length is the last tween's end. */
  duration: number;
  tracks: Track[];
  cues: Cue[];
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

/** A fire-once beat: at `time` (in **frames**), invoke the hook named `hook`. */
export interface Cue {
  time: number;
  hook: string;
}

/**
 * Named actors a doc's tracks resolve against — the live objects created in
 * `build()` (procedural Graphics/Containers/Text, plus `camera`/`physics`).
 * Values are intentionally untyped: the compiler resolves dotted properties
 * against them at runtime.
 */
export type Stage = Record<string, unknown>;

/** Named fire-once closures a doc's cues resolve against (sfx, particle bursts, debris). */
export type Hooks = Record<string, () => void>;
