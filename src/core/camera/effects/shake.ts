import { app } from '@/main';
import type { Camera } from '../camera';

export interface ShakeOptions {
  /** Intensity of the shake in pixels (default: 5) */
  intensity?: number;
  /** Duration of the shake in ms (default: 500) */
  duration?: number;
  /** How many oscillations (default: 10) */
  frequency?: number;
  /** Whether shake decays over time (default: true) */
  decay?: boolean;
  /** Direction: 'both' | 'horizontal' | 'vertical' (default: 'both') */
  direction?: 'both' | 'horizontal' | 'vertical';
}

/**
 * Shake the camera - great for impacts, explosions, damage
 * Uses an additive offset that works with the coordinate system
 */
export function shake(camera: Camera, options: ShakeOptions = {}): void {
  const { intensity = 5, duration = 500, frequency = 10, decay = true, direction = 'both' } = options;

  const oscillationTime = duration / frequency;
  const startTime = performance.now();
  const shakeUpdate = () => {
    const elapsed = performance.now() - startTime;

    if (elapsed >= duration) {
      // Return to base position
      camera.offsetX = 0;
      camera.offsetY = 0;
      app.ticker.remove(shakeUpdate);
      return;
    }

    const progress = elapsed / duration;
    const cycle = Math.floor(elapsed / oscillationTime);
    const currentIntensity = decay ? intensity * (1 - progress) : intensity;

    // Generate consistent random offset per cycle
    const seed = cycle * 1000;
    const offsetX = direction !== 'vertical' ? (Math.sin(seed) * 2 - 1) * currentIntensity : 0;
    const offsetY = direction !== 'horizontal' ? (Math.cos(seed * 1.5) * 2 - 1) * currentIntensity : 0;

    camera.offsetX = offsetX;
    camera.offsetY = offsetY;
  };

  app.ticker.add(shakeUpdate);
}
