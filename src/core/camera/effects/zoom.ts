import { animate, type EasingParam } from 'animejs';
import { CameraEasing, type Camera } from '../camera';

export interface ZoomOptions {
  /** Target scale (1 = normal, 2 = 2x zoom in, 0.5 = zoom out) */
  scale: number;
  /** Duration in ms (default: 300) */
  duration?: number;
  /** Easing function (default: 'easeInOutSine') */
  easing?: EasingParam;
  /** Zoom origin point (default: center of layer) */
  origin?: { x: number; y: number };
}

/**
 * Zoom the camera - great for focus effects or dramatic moments
 * Note: origin parameter moves the camera to that position before zooming
 */
export async function zoom(camera: Camera, options: ZoomOptions): Promise<void> {
  const { scale, duration = 300, easing = CameraEasing.smooth, origin } = options;

  if (duration === 0) {
    camera.scale = scale;
    return;
  }

  // If origin is specified, move the camera to look at that point
  if (origin) {
    camera.x = origin.x;
    camera.y = origin.y;
  }

  await camera.track(
    animate(camera, {
      scale,
      duration,
      easing,
    }),
  );
}

/**
 * Zoom in (scale > 1)
 */
export async function zoomIn(camera: Camera, scale = 1.5, duration = 300): Promise<void> {
  return zoom(camera, { scale, duration });
}

/**
 * Zoom out (scale < 1)
 */
export async function zoomOut(camera: Camera, scale = 0.8, duration = 300): Promise<void> {
  return zoom(camera, { scale, duration });
}
