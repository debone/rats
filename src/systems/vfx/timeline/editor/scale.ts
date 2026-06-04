import type { Track } from '../types';

/**
 * Pure time-axis math for the editor's zoomable, scrollable lane strip (Phase E).
 *
 * The old editor pinned the whole duration onto the visible width with no scale
 * factor, so there was no zoom. Here time (in **frames**) maps to pixels through an
 * explicit `pxPerFrame`, the lanes are a strip wider than the viewport, and these
 * helpers pick sensible ruler ticks, snap dragged times, and read a track's value
 * at the playhead — all DOM-free so they can be unit-tested.
 */

/** Candidate ruler tick spacings in frames — "nice" counts across zoom levels. */
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 3000];

/**
 * Pick the smallest nice tick spacing (frames) whose on-screen gap is at least
 * `minGapPx`, so labels never crowd. Density follows zoom: zoom in → finer ticks.
 */
export function chooseTickStep(pxPerFrame: number, minGapPx = 64): number {
  for (const step of TICK_STEPS) {
    if (step * pxPerFrame >= minGapPx) return step;
  }
  return TICK_STEPS[TICK_STEPS.length - 1];
}

/** The tick times (frames) from 0..duration inclusive at the chosen spacing. */
export function tickTimes(duration: number, pxPerFrame: number, minGapPx = 64): number[] {
  const step = chooseTickStep(pxPerFrame, minGapPx);
  const out: number[] = [];
  for (let t = 0; t <= duration + 0.5; t += step) out.push(Math.round(t));
  return out;
}

/** "Fit" zoom: spread the whole duration across the available lane viewport. */
export function fitScale(viewportPx: number, duration: number): number {
  if (duration <= 0 || viewportPx <= 0) return 1;
  return viewportPx / duration;
}

export interface SnapOpts {
  /** Grid spacing in frames to round to (e.g. 1). 0/undefined disables grid snap. */
  grid?: number;
  /** Other times (keys/cues) to snap onto when within threshold. */
  targets?: number[];
  /** Max distance in frames at which a target wins over the grid result. */
  thresholdMs?: number;
}

/**
 * Snap a dragged time: round to the grid, then prefer the nearest target (other
 * key/cue) if it's within `thresholdMs`. Callers pass a modifier-gated empty
 * `opts` to disable snapping entirely.
 */
export function snapTime(time: number, opts: SnapOpts = {}): number {
  const { grid, targets, thresholdMs = 0 } = opts;
  let best = grid && grid > 0 ? Math.round(time / grid) * grid : time;
  if (targets?.length && thresholdMs > 0) {
    let nearest = best;
    let nearestDist = Math.abs(best - time);
    for (const t of targets) {
      const d = Math.abs(t - time);
      if (d <= thresholdMs && d < nearestDist) {
        nearest = t;
        nearestDist = d;
      }
    }
    best = nearest;
  }
  return Math.round(best);
}

/**
 * The track's value at `time`, for the per-row readout (G1). Interpolates between
 * the two surrounding numeric keys **along the later key's easing** (matching how
 * the compiler tweens), so the readout and a key inserted here sit on the curve.
 * For string-valued tracks (tint) or outside the keyed range it returns the nearest
 * key's value. Empty → `null`.
 */
export function valueAtTime(track: Track, time: number): number | string | null {
  const keys = track.keys;
  if (keys.length === 0) return null;
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      if (typeof a.value !== 'number' || typeof b.value !== 'number') return a.value;
      const span = b.time - a.time || 1;
      const f = easeFn(b.ease)((time - a.time) / span);
      return a.value + (b.value - a.value) * f;
    }
  }
  return last.value;
}

/**
 * Normalized easing curves matching the names offered in the inspector, so the
 * graph's ramps and the interpolated readout bend the way playback does (concave
 * in, overshooting back, …). Approximations — close enough for the editor.
 */
const EASES_FN: Record<string, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) ** 2,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) ** 2,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

/** Resolve an ease name (incl. ''/undefined → linear) to its curve function. */
export function easeFn(name?: string): (t: number) => number {
  return EASES_FN[name || 'linear'] ?? EASES_FN.linear;
}
