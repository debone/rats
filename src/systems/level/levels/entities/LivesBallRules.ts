import { getEntitiesOfKind } from '@/core/entity/entity';
import { defineEntity, getUnmount } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useGameEvent } from '@/hooks/hooks';
import { Levels_LoseBallCommand } from '../commands/LoseBallCommand';

export interface LivesBallRulesProps {
  onLose: () => void;
  checkLoseCondition: () => boolean;
}

export interface LivesBallRulesEntity extends EntityBase<typeof ENTITY_KINDS.livesBallRules> {}

export const LivesBallRules = defineEntity((props: LivesBallRulesProps): LivesBallRulesEntity => {
  const unmount = getUnmount();

  useGameEvent(GameEvent.BALL_LOST, async () => {
    await execute(Levels_LoseBallCommand);
    if (props.checkLoseCondition()) {
      props.onLose();
      return;
    }
    getEntitiesOfKind(ENTITY_KINDS.breakoutLevel)[0]?.createBall();
  });

  return {
    kind: ENTITY_KINDS.livesBallRules,
    destroy() {
      unmount();
    },
  };
});
