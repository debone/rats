import { CameraEasing, type Camera } from '@/core/camera/camera';
import { animate, type EasingParam, type Timeline } from 'animejs';
import type { TimelineLike } from '../timeline/compile';

/**
 * Timeline-native camera effects.
 *
 * Each function adds tween(s) onto an existing anime.js `Timeline` so camera
 * motion is driven by the same clock as every other tween in the sequence.
 * That means `timeline.speed` slows/accelerates the camera together with the
 * rest of the choreography, and the debug panel's seek scrubs camera state
 * exactly like it scrubs opacity or scale.
 *
 * WHEN TO USE THESE vs. the standalone functions in `core/camera/effects/`:
 * - Inside a `kind: 'sequence'` `build` function → use these (`addShake` etc.).
 *   The camera becomes part of the seekable timeline.
 * - Inside a `kind: 'burst'` `play` function or any entity event handler →
 *   use the standalone `shake()` / `zoom()` etc. (fire-once, wall-clock is fine).
 */

// ---------------------------------------------------------------------------
// Shake
// ---------------------------------------------------------------------------

export interface ShakeOptions {
  /** Intensity of the shake in pixels (default: 5) */
  intensity?: number;
  /** Duration of the shake in ms (default: 500) */
  duration?: number;
  /** How many oscillation steps (default: 10) */
  frequency?: number;
  /** Whether shake decays over time (default: true) */
  decay?: boolean;
  /** Direction: 'both' | 'horizontal' | 'vertical' (default: 'both') */
  direction?: 'both' | 'horizontal' | 'vertical';
}

/**
 * Add a camera shake to a timeline, starting at `at` ms.
 *
 * Models the shake as a keyframe array so it is a single tween:
 * `frequency` equally-spaced steps of pseudo-random offset, decaying to zero.
 * Because it's a `tl.add`, it honors `timeline.speed` and scrubs correctly.
 */
// export function addShake(tl: Timeline, camera: Camera, options: ShakeOptions = {}, at = 0): void {
export function addShake(tl: TimelineLike, camera: Camera, options: ShakeOptions = {}, at = 0): void {
  const { intensity = 5, duration = 500, frequency = 10, decay = true, direction = 'both' } = options;

  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = 0; i < frequency; i++) {
    const t = i / frequency;
    const amp = decay ? intensity * (1 - t) : intensity;
    const seed = i * 1000;
    xs.push(direction !== 'vertical' ? (Math.sin(seed) * 2 - 1) * amp : 0);
    ys.push(direction !== 'horizontal' ? (Math.cos(seed * 1.5) * 2 - 1) * amp : 0);
  }
  // Final keyframe: return to rest.
  xs.push(0);
  ys.push(0);

  // tl.add(camera, { offsetX: xs, offsetY: ys, duration, ease: 'linear' }, at);
  animate(camera, { offsetX: xs, offsetY: ys, duration, ease: 'linear' });
}

// ---------------------------------------------------------------------------
// Punch
// ---------------------------------------------------------------------------

export interface PunchOptions {
  /** Scale multiplier at peak (default: 1.1) */
  intensity?: number;
  /** Total duration in ms (default: 150) */
  duration?: number;
}

/**
 * Add a camera punch (quick zoom-in then snap-back) to a timeline starting at
 * `at` ms. Captures the camera's current scale as the baseline — call this
 * before any zoom tweens that also modify `camera.scale`.
 */
export function addPunch(tl: Timeline, camera: Camera, options: PunchOptions = {}, at = 0): void {
  const { intensity = 1.1, duration = 150 } = options;
  const originalScale = camera.scale;
  const half = duration / 2;
  tl.add(camera, { scale: originalScale * intensity, duration: half, ease: CameraEasing.impact }, at);
  tl.add(camera, { scale: originalScale, duration: half, ease: CameraEasing.bounce }, at + half);
}

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

export interface ZoomOptions {
  /** Target scale (1 = normal, 2 = 2× zoom in, 0.5 = zoom out) */
  scale: number;
  /** Duration in ms (default: 300) */
  duration?: number;
  /** Easing function (default: CameraEasing.smooth) */
  easing?: EasingParam;
  /** World-space point to look at before zooming (default: current position) */
  origin?: { x: number; y: number };
}

/** Add a camera zoom to a timeline starting at `at` ms. Seekable. */
export function addZoom(tl: Timeline, camera: Camera, options: ZoomOptions, at = 0): void {
  const { scale, duration = 300, easing = CameraEasing.smooth, origin } = options;
  if (origin) {
    tl.add(camera, { x: origin.x, y: origin.y, scale, duration, ease: easing }, at);
  } else {
    tl.add(camera, { scale, duration, ease: easing }, at);
  }
}

// ---------------------------------------------------------------------------
// Pan
// ---------------------------------------------------------------------------

export interface PanOptions {
  /** Target world x position to look at */
  x: number;
  /** Target world y position to look at */
  y: number;
  /** Duration in ms (default: 500) */
  duration?: number;
  /** Easing function (default: CameraEasing.smooth) */
  easing?: EasingParam;
}

/** Add a camera pan to a timeline starting at `at` ms. Seekable. */
export function addPan(tl: Timeline, camera: Camera, options: PanOptions, at = 0): void {
  const { x, y, duration = 500, easing = CameraEasing.smooth } = options;
  tl.add(camera, { x, y, duration, ease: easing }, at);
}

// ---------------------------------------------------------------------------
// Fade
// ---------------------------------------------------------------------------

export interface FadeOptions {
  /** Target alpha (0–1) */
  to: number;
  /** Duration in ms (default: 300) */
  duration?: number;
  /** Easing function (default: linear) */
  easing?: EasingParam;
}

/** Add a camera fade to a timeline starting at `at` ms. Seekable. */
export function addFade(tl: Timeline, camera: Camera, options: FadeOptions, at = 0): void {
  const { to, duration = 300, easing = 'linear' } = options;
  tl.add(camera, { alpha: to, duration, ease: easing }, at);
}
