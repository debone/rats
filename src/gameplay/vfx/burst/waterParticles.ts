import { ASSETS } from '@/assets';
import type { EmitterConfig } from '@/core/particles/ParticleEmitter';
import { defineBurst } from '@/systems/vfx/types';
import { Assets } from 'pixi.js';

export interface WaterParticlesParams {
  /** Screen-space position of the burst. */
  x: number;
  y: number;
  /** Particles to emit (default 8). */
  count?: number;
}

export const waterParticles = defineBurst<WaterParticlesParams>({
  kind: 'burst',
  id: 'waterParticles',
  priority: 'normal',
  emitter: (): EmitterConfig => {
    return {
      texture: Assets.get(ASSETS.tiles).textures.ball,
      maxParticles: 100,
      lifespan: { min: 200, max: 500 },
      speed: { min: 40, max: 80 },
      angle: { min: -150, max: -30 },
      scale: { min: 0.15, max: 0.25 },
      gravityY: 100,
      tint: 0xff9977,
    };
  },
  play({ x, y, count = 10 }, { emitter }) {
    emitter.explode(count, x, y);
  },
});
