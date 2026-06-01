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

/** Walk a dotted property path to the object that owns the leaf property. */
function resolve(actor: object, property: string): { target: object; prop: string } {
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
 * Per cue: `tl.call(hooks[cue.hook], frameMs)` — a fire-once beat, muted on scrub.
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

    // Seed: reproduce the property's value at the first key as an instant set, so
    // scrubbing before any motion still shows the authored starting state.
    tl.add(target, { [prop]: keys[0].value, duration: 1 }, framesToMs(keys[0].time));

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

  for (const cue of doc.cues) {
    const hook = hooks[cue.hook];
    if (!hook) {
      console.warn(`[timeline:${doc.id}] cue references unknown hook "${cue.hook}"`);
      continue;
    }
    tl.call(hook, framesToMs(cue.time));
  }
}
