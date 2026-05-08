import { ASSETS, TILED_MAPS } from '@/assets';
import { defineEntity } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { setLevelState } from '@/data/game-state';
import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { type DoorEntity } from '@/gameplay/entities/Door';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';
import { PhysicsSystem } from '@/systems/physics/system';

export const Level1 = defineEntity(() => {
  const { withChildren } = useChildren();
  // const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-1');

  setLevelState({ id: 'level-1', name: t.dict['level-1.name'] });

  let door: DoorEntity | undefined;
  let bricks = 0;

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_1 });
    const physics = BreakoutPhysics({ levelId: 'level-1', rubeAsset: ASSETS.level_1_rube });

    physics.bodies.forEach(({ bodyId, tag, userData }) => {
      getGameContext().systems.get(PhysicsSystem).registerOrphanBody(bodyId);
    });
  });
});
