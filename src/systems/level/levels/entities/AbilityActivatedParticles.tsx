import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { ParticleEmitterEntity } from '@/core/particles/ParticleEmitterEntity';
import { getGameContext } from '@/data/game-context';

export const AbilityActivatedParticles = () => {
  const container = getGameContext().container!;
  const textures = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

  return ParticleEmitterEntity({
    container,
    config: {
      texture: textures['scraps#0'],
      maxParticles: 60,
      lifespan: { min: 300, max: 600 },
      speed: { min: 60, max: 140 },
      angle: { min: -180, max: 180 },
      scale: { start: { min: 0.2, max: 0.5 }, end: 0 },
      tint: { start: 0xffff88, end: 0xffffff },
      gravityY: 120,
      rotate: { min: -180, max: 180 },
      x: { min: -12, max: 12 },
      y: { min: -12, max: 12 },
    },
  });
};
