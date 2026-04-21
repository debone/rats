import { ASSETS, TILED_MAPS } from '@/assets';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { t } from '@/i18n/i18n';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition } from 'phaser-box2d';
import { state } from '@/core/state/state';

import type { BreakoutLevelProps } from './BreakoutLevel';
import { Brick, type BrickEntity } from './entities/Brick';
import { CatPiece } from './entities/CatBody';
import { CatTail } from './entities/CatTail';
import { BlueCheese, GreenCheese, YellowCheese } from './entities/Cheese';
import { Door, type DoorEntity } from './entities/Door';
import { Scrap } from './entities/Scrap';
import { StrongBrick, type StrongBrickEntity } from './entities/StrongBrick';

/** Each value is a factory so every level load starts with fresh closure state. */
export const LEVEL_DEFINITIONS: Record<string, () => BreakoutLevelProps> = {
  'level-0': () => {
    let doorA: DoorEntity | undefined;
    let doorB: DoorEntity | undefined;
    let doorC: DoorEntity | undefined;
    let doorBCheeseLeft = 5;

    return {
      levelId: 'level-0',
      name: t.dict['level-0.name'],
      rubeAsset: ASSETS.levels_level_0_rube,
      background: { tiledMap: TILED_MAPS.backgrounds_level_0 },
      winBrickCount: 5,
      onBodyLoad({ bodyId, tag, userData, particles, addBrick, removeBrick }) {
        if (tag === 'brick') {
          const powerUp = userData?.powerup as BrickPowerUps | undefined;
          addBrick();

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
                  : () => { doorBCheeseLeft--; if (doorBCheeseLeft === 0) doorB?.open(); };

            state(
              {
                brick: (transition) => {
                  addBrick();
                  Brick({
                    bodyId: brickBodyId,
                    spawnPos: { x: brickSpawnX, y: brickSpawnY },
                    debrisEmitter: particles.brickDebris,
                    powerUp,
                    onBreak: () => { removeBrick(); transition('cheese'); },
                  });
                },
                cheese: (transition) => {
                  Cheese({
                    pos: { x: brickSpawnX, y: brickSpawnY },
                    onCollected: () => transition('done'),
                    onLost: () => { brickBodyId = undefined; transition('brick'); },
                  });
                },
                done: () => { onDone(); },
              },
              'brick',
            );
          } else {
            Brick({
              powerUp,
              bodyId,
              debrisEmitter: particles.brickDebris,
              onBreak: (brick: BrickEntity) => {
                Scrap({ pos: { x: brick.spawnPos.x - 0.25, y: brick.spawnPos.y } });
                Scrap({ pos: { x: brick.spawnPos.x + 0.25, y: brick.spawnPos.y } });
                removeBrick();
              },
            });
          }
          return true;
        }

        if (tag === 'door') {
          const pos = b2Body_GetPosition(bodyId);
          getGameContext().systems.get(PhysicsSystem).queueDestruction(bodyId);
          const door = Door({
            spawnPos: { x: pos.x, y: pos.y },
            length: 2,
            sound: ASSETS.sounds_Chest_Open_Creak_3_1,
          });
          if (userData?.doorName === 'door-a') doorA = door;
          else if (userData?.doorName === 'door-b') { doorB = door; door.openingDirection = 'right'; }
          else if (userData?.doorName === 'door-c') doorC = door;
          return true;
        }

        return false;
      },
    };
  },

  'level-1': () => {
    let door: DoorEntity | undefined;

    return {
      levelId: 'level-1',
      name: t.dict['level-1.name'],
      rubeAsset: ASSETS.level_1_rube,
      background: { tiledMap: TILED_MAPS.backgrounds_level_1 },
      winBrickCount: 5,
      onBodyLoad({ bodyId, tag, userData, particles, addBrick, removeBrick }) {
        if (tag === 'brick') {
          const powerUp = userData?.powerup as BrickPowerUps | undefined;
          addBrick();
          Brick({
            bodyId,
            debrisEmitter: particles.brickDebris,
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
              if (removeBrick()) door?.open();
            },
          });
          return true;
        }

        if (tag === 'door') {
          const pos = b2Body_GetPosition(bodyId);
          getGameContext().systems.get(PhysicsSystem).queueDestruction(bodyId);
          door = Door({
            spawnPos: { x: pos.x, y: pos.y },
            length: 4,
            sound: ASSETS.sounds_Chest_Open_Creak_3_1,
          });
          return true;
        }

        return false;
      },
    };
  },

  'level-2': () => ({
    levelId: 'level-2',
    name: t.dict['level-2.name'],
    rubeAsset: ASSETS.levels_level_2_split_rube,
    background: { tiledMap: TILED_MAPS.backgrounds_level_2_split, includeBroadBg: true },
    winBrickCount: 5,
    onBodyLoad({ bodyId, tag, particles, addBrick, removeBrick }) {
      const ctx = getGameContext();

      if (tag === 'brick') {
        addBrick();
        Brick({
          bodyId,
          debrisEmitter: particles.brickDebris,
          onBreak: (brick: BrickEntity) => {
            const { x, y } = brick.spawnPos;
            ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(brick.bodyId), position: { x, y }, score: 100 });
            const r = Math.random();
            if (r < 0.35) YellowCheese({ pos: { x, y } });
            else if (r < 0.7) { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
            else Scrap({ pos: { x, y } });
            removeBrick();
          },
        });
        return true;
      }

      if (tag === 'strong-brick') {
        addBrick();
        StrongBrick({
          bodyId,
          debrisEmitter: particles.brickDebris,
          initialLife: 2,
          onBreak: (brick: StrongBrickEntity) => {
            const { x, y } = brick.spawnPos;
            ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(brick.bodyId), position: { x, y }, score: 100 });
            if (Math.random() < 0.55) YellowCheese({ pos: { x, y } });
            else { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
            removeBrick();
          },
        });
        return true;
      }

      return false;
    },
  }),

  'level-3': () => ({
    levelId: 'level-3',
    name: t.dict['level-3.name'],
    rubeAsset: ASSETS.levels_level_3_rube,
    background: { tiledMap: TILED_MAPS.backgrounds_level_3, includeBroadBg: true },
    winBrickCount: 5,
    onBodyLoad({ bodyId, tag, particles, addBrick, removeBrick }) {
      const ctx = getGameContext();

      if (tag === 'brick') {
        addBrick();
        Brick({
          bodyId,
          debrisEmitter: particles.brickDebris,
          onBreak: (brick: BrickEntity) => {
            const { x, y } = brick.spawnPos;
            ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(brick.bodyId), position: { x, y }, score: 100 });
            const r = Math.random();
            if (r < 0.3) YellowCheese({ pos: { x, y } });
            else if (r < 0.5) { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
            else Scrap({ pos: { x, y } });
            removeBrick();
          },
        });
        return true;
      }

      if (tag === 'strong-brick') {
        addBrick();
        StrongBrick({
          bodyId,
          debrisEmitter: particles.brickDebris,
          initialLife: 2,
          onBreak: (brick: StrongBrickEntity) => {
            const { x, y } = brick.spawnPos;
            ctx.events.emit(GameEvent.BRICK_DESTROYED, { brickId: String(brick.bodyId), position: { x, y }, score: 100 });
            if (Math.random() < 0.55) YellowCheese({ pos: { x, y } });
            else { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
            removeBrick();
          },
        });
        return true;
      }

      if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        Door({ spawnPos: { x: pos.x, y: pos.y }, length: 1 });
        return true;
      }

      return false;
    },
  }),

  'level-4': () => {
    let door: DoorEntity | undefined;

    return {
      levelId: 'level-4',
      name: t.dict['level-4.name'],
      rubeAsset: ASSETS.levels_level_4_rube,
      background: { tiledMap: TILED_MAPS.backgrounds_level_4 },
      winBrickCount: 5,
      onBodyLoad({ bodyId, tag, userData, particles, addBrick, removeBrick }) {
        const ctx = getGameContext();

        if (tag === 'brick') {
          const powerUp = userData?.powerup as BrickPowerUps | undefined;
          addBrick();
          Brick({
            bodyId,
            debrisEmitter: particles.brickDebris,
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
              if (removeBrick()) door?.open();
            },
          });
          return true;
        }

        if (tag === 'strong-brick') {
          addBrick();
          StrongBrick({
            bodyId,
            debrisEmitter: particles.brickDebris,
            initialLife: 2,
            onBreak: (brick: StrongBrickEntity) => {
              const { x, y } = brick.spawnPos;
              if (Math.random() < 0.55) YellowCheese({ pos: { x, y } });
              else { Scrap({ pos: { x: x - 0.25, y } }); Scrap({ pos: { x: x + 0.25, y } }); }
              removeBrick();
            },
          });
          return true;
        }

        if (tag === 'door') {
          const pos = b2Body_GetPosition(bodyId);
          ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
          door = Door({ spawnPos: { x: pos.x, y: pos.y }, length: 4, sound: ASSETS.sounds_Chest_Open_Creak_3_1 });
          return true;
        }

        if (tag === 'cat-piece') {
          CatTail({ bodyId, texture: 'cat-tail#0' });
          return true;
        }

        if (tag === 'cat-body') {
          CatPiece({ bodyId, texture: 'cat-body#0' });
          return true;
        }

        return false;
      },
    };
  },
};
