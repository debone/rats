import { assert } from '@/core/common/assert';
import { defineEntity, getChildrenOf, getEntitiesOf } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { useGameEvent } from '@/hooks/hooks';
import { NormBall } from '../NormBall';
import { PaddleAndBall } from '../PaddleBall';

export const InfiniteBallRules = defineEntity(() => {
  useGameEvent(GameEvent.BALL_LOST, async () => {
    const paddleBall = getEntitiesOf(PaddleAndBall);
    assert(paddleBall.length === 1, 'PaddleBall not found or too many found');
    const paddleBallEntity = paddleBall[0];

    const balls = getChildrenOf(paddleBallEntity, NormBall);
    if (balls.length === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      paddleBallEntity.createBall();
    }
  });
});
