import { ASSETS, TILED_MAPS } from '@/assets';
import { defineEntity, getUnmount } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { setLevelState } from '@/data/game-state';
import { ENTITY_KINDS } from '@/entities/entity-kinds';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition } from 'phaser-box2d';

import { useLevelOutcome } from '../Level';
import type { BreakoutLevelEntity } from './BreakoutLevel';
import { Background } from './entities/Background';
import { BreakoutPhysics } from './entities/BreakoutPhysics';
import { Brick, type BrickEntity } from './entities/Brick';
import { BlueCheese, GreenCheese, YellowCheese } from './entities/Cheese';
import { Door, type DoorEntity } from './entities/Door';
import { ExitWin } from './entities/ExitWin';
import { LivesBallRules } from './entities/LivesBallRules';
import { Scrap } from './entities/Scrap';

export const Level1 = defineEntity((_: object): BreakoutLevelEntity => {
  const unmount = getUnmount();
  const { withChildren } = useChildren();
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-1');

  setLevelState({ id: 'level-1', name: t.dict['level-1.name'] });

  let door: DoorEntity | undefined;
  let bricks = 0;

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_1 });

    const pg = BreakoutPhysics({ levelId: 'level-1', rubeAsset: ASSETS.level_1_rube });

    LivesBallRules({ onLose, checkLoseCondition });
    ExitWin({ onWin });

    pg.bodies.forEach(({ bodyId, tag }) => {
      if (tag === 'brick') {
        bricks++;
        Brick({
          bodyId,
          debrisEmitter: pg.particles.brickDebris,
          onBreak: (brick: BrickEntity) => {
            const { x, y } = brick.spawnPos;
            if (brick.powerUp) {
              const pu = brick.powerUp;
              if (pu === 'blue') BlueCheese({ pos: { x, y } });
              else if (pu === 'green') GreenCheese({ pos: { x, y } });
              else YellowCheese({ pos: { x, y } });
            } else {
              const r = Math.random();
              if (r < 0.2) YellowCheese({ pos: { x, y } });
              else if (r < 0.5) { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
              else Scrap({ pos: { x, y } });
            }
            bricks--;
            if (bricks <= 5) door?.open();
          },
        });
        return;
      }

      if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        getGameContext().systems.get(PhysicsSystem).queueDestruction(bodyId);
        door = Door({
          spawnPos: { x: pos.x, y: pos.y },
          length: 4,
          sound: ASSETS.sounds_Chest_Open_Creak_3_1,
        });
        return;
      }

      getGameContext().systems.get(PhysicsSystem).registerOrphanBody(bodyId);
    });
  });

  return {
    kind: ENTITY_KINDS.breakoutLevel,
    destroy() {
      unmount();
    },
  };
});
