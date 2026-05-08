import { defineEntity } from '@/core/entity/scope';
import { useChildren } from '@/hooks/hooks';
import { useLevelOutcome } from '../Level';
import { setLevelState } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import { Background } from './entities/Background';
import { ASSETS, TILED_MAPS } from '@/assets';
import { BreakoutPhysics } from './entities/BreakoutPhysics';
import { Door, type DoorEntity } from './entities/Door';
import { b2Body_GetPosition } from 'phaser-box2d';

export const Level1 = defineEntity(() => {
  const { withChildren } = useChildren();
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-1');

  setLevelState({ id: 'level-1', name: t.dict['level-1.name'] });

  let door: DoorEntity | undefined;
  let bricks = 0;

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_1 });
    const physics = BreakoutPhysics({ levelId: 'level-1', rubeAsset: ASSETS.level_1_rube });

    physics.bodies.forEach(({ bodyId, tag }) => {
      if (tag === 'brick') {
        bricks++;
      } else if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        door = Door({ spawnPos: { x: pos.x, y: pos.y }, length: 4, sound: ASSETS.sounds_Chest_Open_Creak_3_1 });
      }
    });
  });
});
