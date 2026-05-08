import { ASSETS } from '@/assets';
import { ParticleEmitterEntity } from '@/core/particles/ParticleEmitterEntity';
import { getGameContext } from '@/data/game-context';
import { Assets } from 'pixi.js';

export const WallParticles = () => {
  const ctx = getGameContext();
  const container = ctx.container!;

  return ParticleEmitterEntity({
    container,
    config: {
      texture: Assets.get(ASSETS.tiles).textures.ball,
      maxParticles: 100,
      lifespan: { min: 100, max: 700 },
      speed: { min: 20, max: 80 },
      angle: { min: 30, max: -30 },
      scale: { start: { min: 0.15, max: 0.25 }, end: 0 },
      gravityY: 100,
      tint: 0x774444,
    },
  });
};
