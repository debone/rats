import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { ParticleEmitterEntity } from '@/core/particles/ParticleEmitterEntity';
import { getGameContext } from '@/data/game-context';

export const BrickDebrisParticles = () => {
  const ctx = getGameContext();
  const container = ctx.container!;
  const textures = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

  return ParticleEmitterEntity({
    container,
    config: {
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
    },
  });
};
