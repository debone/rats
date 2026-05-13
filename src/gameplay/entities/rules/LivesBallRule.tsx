import { assert } from '@/core/common/assert';
import { defineEntity, getChildrenOf, getEntitiesOf } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { Levels_LoseBallCommand } from '@/gameplay/levels/commands/LoseBallCommand';
import { useGameEvent } from '@/hooks/hooks';
import { NormBall } from '../NormBall';
import { PaddleAndBall } from '../PaddleBall';

export interface LivesBallRulesProps {
  onLose: () => void;
  checkLoseCondition: () => boolean;
}

export const LivesBallRules = defineEntity((props: LivesBallRulesProps) => {
  useGameEvent(GameEvent.BALL_LOST, async () => {
    const paddleBall = getEntitiesOf(PaddleAndBall);
    assert(paddleBall.length === 1, 'PaddleBall not found or too many found');
    const paddleBallEntity = paddleBall[0];

    const balls = getChildrenOf(paddleBallEntity, NormBall);

    if (balls.length === 0) {
      await execute(Levels_LoseBallCommand);

      if (props.checkLoseCondition()) {
        props.onLose();
        return;
      }

      paddleBallEntity.createBall();
    }
  });
});
