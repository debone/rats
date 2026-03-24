import { ASSETS } from '@/assets';
import { ParticleEmitterEntity } from '@/core/particles/ParticleEmitterEntity';
import { getGameContext } from '@/data/game-context';
import { Assets } from 'pixi.js';

export const WaterParticles = () => {
  const ctx = getGameContext();
  const container = ctx.container!;

  return ParticleEmitterEntity({
    container,
    config: {
      texture: Assets.get(ASSETS.tiles).textures.ball,
      maxParticles: 100,
      lifespan: { min: 200, max: 500 },
      speed: { min: 20, max: 80 },
      angle: { min: -150, max: -30 },
      scale: { min: 0.15, max: 0.25 },
      gravityY: 100,
      tint: 0xff9977,
    },
  });
};
