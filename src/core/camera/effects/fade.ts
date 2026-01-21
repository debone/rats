import { animate, type EasingParam } from 'animejs';
import type { Camera } from '../camera';

export interface FadeOptions {
  /** Target alpha (0-1) */
  to: number;
  /** Duration in ms (default: 300) */
  duration?: number;
  /** Easing function (default: 'linear') */
  easing?: EasingParam;
}

/**
 * Fade the camera layers - great for transitions
 */
export async function fade(camera: Camera, options: FadeOptions): Promise<void> {
  const { to, duration = 300, easing = 'linear' } = options;

  if (duration === 0) {
    camera.alpha = to;
    return;
  }

  await camera.track(animate(camera, { alpha: to, duration, easing }));
}

/**
 * Fade in from transparent
 */
export async function fadeIn(camera: Camera, duration = 300, easing: EasingParam = 'linear'): Promise<void> {
  return fade(camera, { to: 1, duration, easing });
}

/**
 * Fade out to transparent
 */
export async function fadeOut(camera: Camera, duration = 300, easing: EasingParam = 'linear'): Promise<void> {
  return fade(camera, { to: 0, duration, easing });
}
