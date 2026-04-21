import { getEntitiesOfKind } from '@/core/entity/entity';
import { defineEntity, getUnmount } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useGameEvent } from '@/hooks/hooks';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { AbilityActivatedParticles } from './AbilityActivatedParticles';

export interface CrewAbilityVFXEntity extends EntityBase<typeof ENTITY_KINDS.particleEmitter> {
  destroy(): void;
}

/** Fires a particle burst at the paddle whenever any crew ability activates. */
export const CrewAbilityVFX = defineEntity((): CrewAbilityVFXEntity => {
  const unmount = getUnmount();
  const { emitter } = AbilityActivatedParticles();

  function burst() {
    const paddles = getEntitiesOfKind(ENTITY_KINDS.paddle);
    if (paddles.length === 0) return;
    const { x, y } = BodyToScreen(paddles[0].bodyId);
    emitter.explode(20, x, y - 20);
  }

  const crewEvents = [
    GameEvent.CREW_SPAWN_BALL,
    GameEvent.CREW_HASTE_BALLS,
    GameEvent.CREW_DOUBLE_BALLS,
    GameEvent.CREW_RECALL_BALLS,
    GameEvent.CREW_EXPLODE_BALLS,
    GameEvent.CREW_GHOST_BALLS,
  ] as const;

  for (const event of crewEvents) {
    useGameEvent(event, burst);
  }

  return {
    kind: ENTITY_KINDS.particleEmitter,
    emitter,
    destroy() {
      unmount();
    },
  };
});
