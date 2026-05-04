import { getEntitiesOf } from '@/core/entity/entity';
import { defineEntity } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { useGameEvent } from '@/hooks/hooks';
import { BreakoutPhysics } from './BreakoutPhysics';

export const InfiniteBallRules = defineEntity((_: object) => {
  useGameEvent(GameEvent.BALL_LOST, async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    getEntitiesOf(BreakoutPhysics)[0]?.createBall();
  });

  return {};
});

export type InfiniteBallRulesEntity = ReturnType<typeof InfiniteBallRules>;
