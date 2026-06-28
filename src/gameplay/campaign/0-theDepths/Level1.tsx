import { TILED_MAPS } from '@/assets';
import { attach, defineEntity, getChildrenOf } from '@/core/entity/scope';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { Brick } from '@/gameplay/entities/bricks/Brick';
import { CrewAbilities } from '@/gameplay/entities/CrewAbilities';
import { Door } from '@/gameplay/entities/Door';
import { PaddleAndBall } from '@/gameplay/entities/PaddleBall';
import { ExitWin } from '@/gameplay/entities/rules/ExitWin';
import { LivesBallRules } from '@/gameplay/entities/rules/LivesBallRule';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const Level1 = defineEntity(() => {
  const { withChildren } = useChildren();

  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-1');
  setLevelState({ id: 'level-1', name: t.dict['level-1.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_1 });

    LivesBallRules({
      onLose,
      checkLoseCondition,
    });
    ExitWin({
      onWin,
    });

    CrewAbilities();

    const physics = BreakoutPhysics({ levelId: 'level-1', geometryAsset: 'geometry/level-1.json' });

    const paddleBall = PaddleAndBall({ levelId: 'level-1', paddleJoint: physics.paddleJoint });

    paddleBall.createBall();

    const bricks = getChildrenOf(physics, Brick);
    const [door] = getChildrenOf(physics, Door);

    let remaining = bricks.length;

    for (const brick of bricks) {
      attach(brick, (b) => {
        useSubscribe(b.events, 'broken', () => {
          remaining--;
          if (remaining <= 48 && door?.closed) {
            door?.open();
          }
        });
      });
    }
  });
});
