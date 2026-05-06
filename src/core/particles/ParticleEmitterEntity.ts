import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { Container } from 'pixi.js';
import { type EmitterConfig, ParticleEmitter } from './ParticleEmitter';

export interface ParticleEmitterProps {
  container: Container;
  config: EmitterConfig;
}

export interface ParticleEmitterEntity extends EntityBase {
  emitter: ParticleEmitter;
}

export const ParticleEmitterEntity = defineEntity(({ container, config }: ParticleEmitterProps) => {
  const emitter = new ParticleEmitter(config);
  emitter.container.zIndex = 1000;
  container.addChild(emitter.container);

  onCleanup(() => {
    emitter.destroy();
  });

  return entity<ParticleEmitterEntity>({
    emitter,
  });
});
