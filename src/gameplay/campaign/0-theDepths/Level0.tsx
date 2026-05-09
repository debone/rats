import { ASSETS, TILED_MAPS } from '@/assets';
import { defineEntity } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { setLevelState } from '@/data/game-state';
import { state } from '@/core/state/state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { useChildren } from '@/hooks/hooks';
import { t } from '@/i18n/i18n';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition } from 'phaser-box2d';

import { Background } from '@/gameplay/entities/Background';
import { BreakoutPhysics } from '@/gameplay/entities/BreakoutPhysics';
import { Brick, type BrickEntity } from '@/gameplay/entities/Brick';
import { BlueCheese, GreenCheese, YellowCheese } from '@/gameplay/entities/Cheese';
import { Door, type DoorEntity } from '@/gameplay/entities/Door';
import { ExitWin } from '@/gameplay/entities/ExitWin';
import { InfiniteBallRules } from '@/gameplay/entities/InfiniteBallRules';
import { Scrap } from '@/gameplay/entities/Scrap';
import { useLevelOutcome } from '@/gameplay/levels/hooks/useLevelOutcome';

export const Level0 = defineEntity(() => {
  const { withChildren } = useChildren();
  const { onWin } = useLevelOutcome('level-0');

  setLevelState({ id: 'level-0', name: t.dict['level-0.name'] });

  let doorA: DoorEntity | undefined;
  let doorB: DoorEntity | undefined;
  let doorC: DoorEntity | undefined;
  let doorBCheeseLeft = 5;

  withChildren(() => {
    Background({ tiledMap: TILED_MAPS.backgrounds_level_0 });

    const pg = BreakoutPhysics({ levelId: 'level-0', rubeAsset: ASSETS.levels_level_0_rube });

    InfiniteBallRules();
    ExitWin({ onWin });

    const ctx = getGameContext();

    pg.bodies.forEach(({ bodyId, tag, userData }) => {
      if (tag === 'brick') {
        const powerUp = userData?.powerup as BrickPowerUps | undefined;

        if (powerUp) {
          let brickBodyId: typeof bodyId | undefined = bodyId;
          const spawnPos = b2Body_GetPosition(bodyId);
          const brickSpawnX = spawnPos.x;
          const brickSpawnY = spawnPos.y;

          const Cheese =
            powerUp === 'blue' ? BlueCheese : powerUp === 'green' ? GreenCheese : YellowCheese;

          const onDone =
            powerUp === 'blue'
              ? () => doorA?.open()
              : powerUp === 'green'
                ? () => doorC?.open()
                : () => {
                    doorBCheeseLeft--;
                    if (doorBCheeseLeft === 0) doorB?.open();
                  };

          state(
            {
              brick: (transition) => {
                Brick({
                  bodyId: brickBodyId,
                  spawnPos: { x: brickSpawnX, y: brickSpawnY },
                  debrisEmitter: pg.particles.brickDebris.emitter,
                  powerUp,
                  onBreak: () => {
                    transition('cheese');
                  },
                });
              },
              cheese: (transition) => {
                Cheese({
                  pos: { x: brickSpawnX, y: brickSpawnY },
                  onCollected: () => transition('done'),
                  onLost: () => {
                    brickBodyId = undefined;
                    transition('brick');
                  },
                });
              },
              done: () => {
                onDone();
              },
            },
            'brick',
          );
        } else {
          Brick({
            powerUp,
            bodyId,
            debrisEmitter: pg.particles.brickDebris.emitter,
            onBreak: (brick: BrickEntity) => {
              Scrap({ pos: { x: brick.spawnPos.x - 0.25, y: brick.spawnPos.y } });
              Scrap({ pos: { x: brick.spawnPos.x + 0.25, y: brick.spawnPos.y } });
            },
          });
        }
        return;
      }

      if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        const door = Door({
          spawnPos: { x: pos.x, y: pos.y },
          length: 2,
          sound: ASSETS.sounds_Chest_Open_Creak_3_1,
        });
        if (userData?.doorName === 'door-a') doorA = door;
        else if (userData?.doorName === 'door-b') {
          doorB = door;
          door.openingDirection = 'right';
        } else if (userData?.doorName === 'door-c') doorC = door;
        return;
      }

      ctx.systems.get(PhysicsSystem).registerOrphanBody(bodyId);
    });
  });
});
