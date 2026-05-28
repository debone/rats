import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { shake } from '@/core/camera/effects/shake';
import type { EmitterConfig } from '@/core/particles/ParticleEmitter';
import { defineBurst } from '../types';

/**
 * Debris + camera shake when a brick breaks.
 *
 * Self-contained: the emitter config (formerly in `BrickDebrisParticles`) and
 * the impact behavior (formerly inline in `Brick.hit()` / `StrongBrick.hit()`)
 * live here. Parametric `count`/`intensity` cover all brick break flavors —
 * normal break, strong-brick chip, strong-brick break — while sharing one
 * pooled emitter.
 */
export interface BrickBreakParams {
  /** Screen-space position of the burst. */
  x: number;
  y: number;
  /** Particles to emit (default 8). */
  count?: number;
  /** Camera shake intensity in pixels (default 1; pass 0 for no shake). */
  intensity?: number;
}

export const brickBreak = defineBurst<BrickBreakParams>({
  kind: 'burst',
  id: 'brickBreak',
  priority: 'normal',
  emitter: (): EmitterConfig => {
    const textures = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
    return {
      texture: textures['scraps#0'],
      maxParticles: 100,
      lifespan: { min: 200, max: 300 },
      speed: { min: 40, max: 80 },
      angle: { min: -450, max: 225 },
      scale: { start: { min: 0.3, max: 0.6 }, end: 0.2 },
      gravityY: 400,
      rotate: { min: -180, max: 180 },
      x: { min: -16, max: 16 },
      y: { min: -8, max: 8 },
    };
  },
  play({ x, y, count = 8, intensity = 1 }, { emitter, camera }) {
    emitter.explode(count, x, y);
    if (intensity > 0) {
      shake(camera, { intensity, duration: 300 });
    }
  },
});
