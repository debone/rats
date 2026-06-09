import { defineEntity } from '@/core/entity/scope';
import { setLevelState } from '@/data/game-state';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { CrewAbilities } from '@/gameplay/entities/CrewAbilities';
import { PaddleAndBall } from '@/gameplay/entities/PaddleBall';
import { ExitShop } from '@/gameplay/entities/rules/ExitShop';
import { LivesBallRules } from '@/gameplay/entities/rules/LivesBallRule';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';

export const ShopLevel0 = defineEntity(() => {
  const { withChildren } = useChildren();

  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('shop-level-0');
  setLevelState({ id: 'shop-level-0', name: t.dict['shop.name'] });

  withChildren(() => {
    LivesBallRules({
      onLose,
      checkLoseCondition,
    });
    ExitShop({
      onExit: onWin,
    });

    CrewAbilities();

    const physics = BreakoutPhysics({ levelId: 'shop-level-0', geometryAsset: 'geometry/shop-one.json' });

    const paddleBall = PaddleAndBall({ levelId: 'shop-level-0', paddleJoint: physics.paddleJoint });

    paddleBall.createBall();
  });
});
