import { TILED_MAPS } from '@/assets';
import { defineEntity } from '@/core/entity/scope';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { CrewAbilities } from '@/gameplay/entities/CrewAbilities';
import { PaddleAndBall } from '@/gameplay/entities/PaddleBall';
import { ExitWin } from '@/gameplay/entities/rules/ExitWin';
import { LivesBallRules } from '@/gameplay/entities/rules/LivesBallRule';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const Level2 = defineEntity(() => {
  const { withChildren } = useChildren();

  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-2');
  setLevelState({ id: 'level-2', name: t.dict['level-2.name'] });

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_2_split, includeBroadBg: true });

    LivesBallRules({
      onLose,
      checkLoseCondition,
    });
    ExitWin({
      onWin,
    });

    CrewAbilities();

    const physics = BreakoutPhysics({ levelId: 'level-2', geometryAsset: 'geometry/level-2.json' });

    const paddleBall = PaddleAndBall({ levelId: 'level-2', paddleJoint: physics.paddleJoint });

    paddleBall.createBall();
  });
});
