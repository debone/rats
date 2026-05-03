import { getEntitiesOfKind } from '@/core/entity/entity';
import { defineEntity, getUnmount } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useGameEvent } from '@/hooks/hooks';

export interface InfiniteBallRulesEntity extends EntityBase<typeof ENTITY_KINDS.infiniteBallRules> {}

export const InfiniteBallRules = defineEntity((_: object): InfiniteBallRulesEntity => {
  const unmount = getUnmount();

  useGameEvent(GameEvent.BALL_LOST, async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    getEntitiesOfKind(ENTITY_KINDS.breakoutLevel)[0]?.createBall();
  });

  return {
    kind: ENTITY_KINDS.infiniteBallRules,
    destroy() {
      unmount();
    },
  };
});
