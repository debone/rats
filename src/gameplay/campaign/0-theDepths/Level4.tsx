import { ASSETS, TILED_MAPS } from '@/assets';
import { defineEntity } from '@/core/entity/scope';
import { onboardCrewMember, setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { CrewAbilities } from '@/gameplay/entities/CrewAbilities';
import { PaddleAndBall } from '@/gameplay/entities/PaddleBall';
import { ExitWin } from '@/gameplay/entities/rules/ExitWin';
import { LivesBallRules } from '@/gameplay/entities/rules/LivesBallRule';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const Level4 = defineEntity(() => {
  const { withChildren } = useChildren();

  setLevelState({ id: 'level-4', name: t.dict['level-4.name'] });
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-4');

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_4, includeBroadBg: false });

    setTimeout(() => {
      onboardCrewMember('apprentice');
    }, 500);

    LivesBallRules({
      onLose,
      checkLoseCondition,
    });
    ExitWin({
      onWin,
    });

    CrewAbilities();

    const physics = BreakoutPhysics({ levelId: 'level-4', rubeAsset: ASSETS.levels_level_4_rube });

    const paddleBall = PaddleAndBall({ levelId: 'level-3', paddleJoint: physics.paddleJoint });

    paddleBall.createBall();
  });
});
