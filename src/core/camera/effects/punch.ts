import { animate } from 'animejs';
import { CameraEasing, type Camera } from '../camera';

/**
 * Punch effect - quick zoom in and back, good for hits
 */
export async function punch(camera: Camera, intensity = 1.1, duration = 150): Promise<void> {
  const originalScale = camera.scale;

  // Punch in
  await camera.track(
    animate(camera, {
      scale: originalScale * intensity,
      duration: duration / 2,
      easing: CameraEasing.impact,
    }),
  );

  // Return
  await camera.track(
    animate(camera, {
      scale: originalScale,
      duration: duration / 2,
      easing: CameraEasing.bounce,
    }),
  );
}
