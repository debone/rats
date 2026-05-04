import { ASSETS, TILED_MAPS } from '@/assets';
import { defineEntity, getUnmount } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { setLevelState } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
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
import { CatPiece } from './entities/CatBody';
import { CatTail } from './entities/CatTail';
import { Door, type DoorEntity } from './entities/Door';
import { ExitWin } from './entities/ExitWin';
import { LivesBallRules } from './entities/LivesBallRules';
import { Scrap } from './entities/Scrap';
import { StrongBrick, type StrongBrickEntity } from './entities/StrongBrick';

export const Level4 = defineEntity((_: object): BreakoutLevelEntity => {
  const unmount = getUnmount();
  const { withChildren } = useChildren();
  const { onWin, onLose, checkLoseCondition } = useLevelOutcome('level-4');

  setLevelState({ id: 'level-4', name: t.dict['level-4.name'] });

  let door: DoorEntity | undefined;
  let bricks = 0;

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_4 });

    const pg = BreakoutPhysics({ levelId: 'level-4', rubeAsset: ASSETS.levels_level_4_rube });

    LivesBallRules({ onLose, checkLoseCondition });
    ExitWin({ onWin });

    const ctx = getGameContext();

    pg.bodies.forEach(({ bodyId, tag, userData }) => {
      if (tag === 'brick') {
        const powerUp = userData?.powerup as BrickPowerUps | undefined;
        bricks++;
        Brick({
          bodyId,
          debrisEmitter: pg.particles.brickDebris,
          powerUp,
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

      if (tag === 'strong-brick') {
        bricks++;
        StrongBrick({
          bodyId,
          debrisEmitter: pg.particles.brickDebris,
          initialLife: 2,
          onBreak: (brick: StrongBrickEntity) => {
            const { x, y } = brick.spawnPos;
            if (Math.random() < 0.55) YellowCheese({ pos: { x, y } });
            else { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
            bricks--;
            if (bricks <= 5) door?.open();
          },
        });
        return;
      }

      if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        door = Door({ spawnPos: { x: pos.x, y: pos.y }, length: 4, sound: ASSETS.sounds_Chest_Open_Creak_3_1 });
        return;
      }

      if (tag === 'cat-piece') {
        CatTail({ bodyId, texture: 'cat-tail#0' });
        return;
      }

      if (tag === 'cat-body') {
        CatPiece({ bodyId, texture: 'cat-body#0' });
        return;
      }

      ctx.systems.get(PhysicsSystem).registerOrphanBody(bodyId);
    });
  });

  return {
    kind: ENTITY_KINDS.breakoutLevel,
    destroy() {
      unmount();
    },
  };
});
