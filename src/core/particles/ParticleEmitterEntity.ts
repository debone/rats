import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { Container } from 'pixi.js';
import { type EmitterConfig, ParticleEmitter } from './ParticleEmitter';

export interface ParticleEmitterProps {
  container: Container;
  config: EmitterConfig;
}

export interface ParticleEmitterEntity extends EntityBase<typeof ENTITY_KINDS.particleEmitter> {
  emitter: ParticleEmitter;
  destroy(): void;
}

export const ParticleEmitterEntity = defineEntity(
  ({ container, config }: ParticleEmitterProps): ParticleEmitterEntity => {
    const unmount = getUnmount();

    const emitter = new ParticleEmitter(config);
    container.addChild(emitter.container);

    onCleanup(() => {
      emitter.destroy();
    });

    return {
      kind: ENTITY_KINDS.particleEmitter,
      emitter,
      destroy() {
        unmount();
      },
    };
  },
);
