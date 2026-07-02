import { framesToMs } from './time';
import type { Hooks, Stage, TimelineDoc } from './types';

/**
 * The slice of an anime.js `Timeline` the compiler drives. Declared structurally
 * (rather than importing anime's `Timeline`) so the compiler is trivially
 * unit-testable with a spy and never depends on anime's parameter types.
 */
export interface TimelineLike {
  add(target: object, params: Record<string, unknown>, position?: number): unknown;
  call(fn: () => void, position?: number): unknown;
}

/**
 * Track property that drives a Pixi `AnimatedSprite`'s frame from the playhead.
 * Authored values are frame indices; the compiler maps it onto `currentFrame`,
 * whose getter floors, so the sprite steps between whole frames while remaining
 * fully seekable (the timeline, not the ticker, owns the frame — the actor must
 * be built with `autoUpdate: false`).
 */
const FRAME_PROPERTY = 'frame';

/** Walk a dotted property path to the object that owns the leaf property. */
function resolve(actor: object, property: string): { target: object; prop: string } {
  // `frame` is sugar for the AnimatedSprite `currentFrame` setter.
  if (property === FRAME_PROPERTY) return { target: actor, prop: 'currentFrame' };
  const parts = property.split('.');
  let target = actor as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]] as Record<string, unknown>;
  }
  return { target, prop: parts[parts.length - 1] };
}

/**
 * Walk a `TimelineDoc` and emit the exact `tl.add(...)` / `tl.call(...)` calls a
 * human would hand-author — onto a timeline that may already carry code-driven
 * tweens (camera fx, array/onUpdate loops). The two coexist on one playhead.
 *
 * Times are authored in **frames** and converted to milliseconds here via
 * {@link framesToMs}, so anime.js (which runs on wall-clock ms) plays the sequence
 * at the same speed on any display.
 *
 * Per track: seed the first key as an instant set (`duration: 1`), then for each
 * adjacent pair emit an explicit **from→to** tween over the gap (`[from, to]`),
 * using that key's `ease` (the curve that *enters* it). The from-to array is
 * essential: each segment is added at an absolute timeline position, and anime.js
 * resolves an *implicit* start value from the target's build-time value (not the
 * preceding tween's end) — so without pinning `from`, every segment would spring
 * from the original value (a saw-wave / blink) instead of continuing the chain.
 * Dotted properties resolve to nested targets (`actor.scale.x`). `tint` values stay
 * strings so anime color-interpolates.
 *
 * Per cue track: for each key, `tl.call(() => hook(key.value), frameMs)` — a fire-once
 * beat that hands the key's authored value to the hook, muted on scrub.
 */
export function compile(doc: TimelineDoc, stage: Stage, hooks: Hooks, tl: TimelineLike): void {
  for (const track of doc.tracks) {
    const actor = stage[track.actor];
    if (!actor || typeof actor !== 'object') {
      console.warn(`[timeline:${doc.id}] track references unknown actor "${track.actor}"`);
      continue;
    }
    const keys = [...track.keys].sort((a, b) => a.time - b.time);
    if (keys.length === 0) continue;

    const { target, prop } = resolve(actor, track.property);

    // Single-key tracks: instant set at the key time (hold / tint flash).
    // Multi-key tracks: the first segment's [from, to] already pins the start value.
    // Do NOT also seed at keys[0].time — a setter/tween at the same position as the
    // first segment makes anime's replace composition mark both as overridden (~0
    // duration), so nothing renders until some other animation has touched the property.
    // When the first key is after frame 0, seed at t=0 so scrubbing the pre-roll still
    // shows the authored starting value.
    if (keys.length === 1) {
      tl.add(target, { [prop]: keys[0].value, duration: 1 }, framesToMs(keys[0].time));
    } else if (keys[0].time > 0) {
      tl.add(target, { [prop]: keys[0].value, duration: 0 }, 0);
    }

    for (let i = 0; i < keys.length - 1; i++) {
      const from = keys[i];
      const to = keys[i + 1];
      const params: Record<string, unknown> = {
        // Explicit [from, to] so the segment continues the chain rather than
        // springing from the target's original value (see the note above).
        [prop]: [from.value, to.value],
        duration: Math.max(1, framesToMs(to.time - from.time)),
      };
      if (to.ease) params.ease = to.ease;
      tl.add(target, params, framesToMs(from.time));
    }
  }

  for (const cueTrack of doc.cues) {
    const hook = hooks[cueTrack.hook];
    if (!hook) {
      console.warn(`[timeline:${doc.id}] cue references unknown hook "${cueTrack.hook}"`);
      continue;
    }
    for (const key of cueTrack.keys) {
      tl.call(() => hook(tl, key), framesToMs(key.time));
    }
  }

  // Anchor the timeline's end to the authored duration so that a sequence whose
  // last keyframe is before `doc.duration` still runs for its full length.
  // Without this, anime.js ends the timeline at the last tween/cue endpoint.
  if (doc.duration > 0) {
    tl.call(() => {}, framesToMs(doc.duration));
  }
}
