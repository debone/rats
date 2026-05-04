import { getEntitiesOf } from '@/core/entity/entity';
import { defineEntity } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { useGameEvent } from '@/hooks/hooks';
import { Levels_LoseBallCommand } from '../commands/LoseBallCommand';
import { BreakoutPhysics } from './BreakoutPhysics';

export interface LivesBallRulesProps {
  onLose: () => void;
  checkLoseCondition: () => boolean;
}

export const LivesBallRules = defineEntity((props: LivesBallRulesProps) => {
  useGameEvent(GameEvent.BALL_LOST, async () => {
    await execute(Levels_LoseBallCommand);
    if (props.checkLoseCondition()) {
      props.onLose();
      return;
    }
    getEntitiesOf(BreakoutPhysics)[0]?.createBall();
  });

  return {};
});

export type LivesBallRulesEntity = ReturnType<typeof LivesBallRules>;
