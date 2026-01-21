import { animate, type EasingParam } from 'animejs';
import { CameraEasing, type Camera } from '../camera';

export interface PanOptions {
  /** Target x position */
  x: number;
  /** Target y position */
  y: number;
  /** Duration in ms (default: 500) */
  duration?: number;
  /** Easing function (default: 'easeInOutSine') */
  easing?: EasingParam;
}

/**
 * Pan/move the camera - great for following targets or revealing areas
 * x, y are WORLD coordinates (what point to look at)
 */
export async function pan(camera: Camera, options: PanOptions): Promise<void> {
  const { x, y, duration = 500, easing = CameraEasing.smooth } = options;

  if (duration === 0) {
    camera.x = x;
    camera.y = y;
    return;
  }

  // Animate containers to the converted position
  await camera.track(
    animate(camera, {
      x,
      y,
      duration,
      easing,
    }),
  );
}
