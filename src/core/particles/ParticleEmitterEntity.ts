import { defineEntity, onCleanup } from '@/core/entity/scope';
import { Container } from 'pixi.js';
import { type EmitterConfig, ParticleEmitter } from './ParticleEmitter';

export interface ParticleEmitterProps {
  container: Container;
  config: EmitterConfig;
}

export const ParticleEmitterEntity = defineEntity(
  ({ container, config }: ParticleEmitterProps) => {
    const emitter = new ParticleEmitter(config);
    emitter.container.zIndex = 1000;
    container.addChild(emitter.container);

    onCleanup(() => {
      emitter.destroy();
    });

    return { emitter };
  },
);

export type ParticleEmitterEntityType = ReturnType<typeof ParticleEmitterEntity>;
