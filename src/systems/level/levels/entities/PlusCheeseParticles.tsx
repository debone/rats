import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { ParticleEmitterEntity } from '@/core/particles/ParticleEmitterEntity';
import { getGameContext } from '@/data/game-context';

export const PlusCheeseParticles = () => {
  const container = getGameContext().container!;
  const textures = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

  return ParticleEmitterEntity({
    container,
    config: {
      texture: textures['plus-cheese#0'],
      maxParticles: 30,
      lifespan: 1000,
      alpha: { start: 1, end: 0 },
      speed: 10,
      angle: -90,
      gravityY: -10,
      scale: { start: 0.7, end: 0.8 },
      rotate: { min: -10, max: 10 },
      y: { min: -8, max: 8 },
    },
  });
};
