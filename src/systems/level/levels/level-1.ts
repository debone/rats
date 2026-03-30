import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { assert } from '@/core/common/assert';
import { getEntities, type AttachHandle } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import { activateCrewMember, getRunState } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { t } from '@/i18n/i18n';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { Paddle, type PaddleEntity } from '@/systems/level/levels/entities/Paddle';
import { Wall, wallSparkOnBall } from '@/systems/level/levels/entities/Wall';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid, b2JointId } from 'phaser-box2d';
import { Assets } from 'pixi.js';

import { Level } from '../Level';
import { attachPaddleBallSnap } from './attachments/paddleBallSnap';
import { Levels_BallExitedLevelCommand } from './commands/BallExitedCommand';
import { Levels_LevelStartCommand } from './commands/LevelStartCommand';
import { Levels_LoseBallCommand } from './commands/LoseBallCommand';
import { Brick, type BrickEntity } from './entities/Brick';
import { BrickDebrisParticles } from './entities/BrickDebrisParticles';
import { BlueCheese, GreenCheese, YellowCheese } from './entities/Cheese';
import { Door, type DoorEntity } from './entities/Door';
import { KeyListener } from './entities/KeyListener';
import { NormBall } from './entities/NormBall';
import { PlusCheeseParticles } from './entities/PlusCheeseParticles';
import { PlusClayParticles } from './entities/PlusClayParticles';
import { Scrap } from './entities/Scrap';
import { WallParticles } from './entities/WallParticles';
import { WaterParticles } from './entities/WaterParticles';

/**
 * Level 1 - Tutorial/First Level
 * Simple breakout-style level with basic mechanics (entity-based, same pattern as level-0).
 */
export default class Level1 extends Level {
  static id = 'level-1';

  private debug_mode = false;

  private paddleEntity?: PaddleEntity;
  private ballSnap?: AttachHandle<{ launch: () => void; jointId: b2JointId }>;

  private ballsCount = 0;
  private bricksCount = 0;

  constructor() {
    super({
      id: 'level-1',
      name: t.dict['level-1.name'],
    });
  }

  createBall(): void {
    assert(this.paddleEntity, 'Level1 createBall: paddleEntity must be defined');

    const paddlePosition = b2Body_GetPosition(this.paddleEntity.bodyId);
    const normBall = NormBall({ x: paddlePosition.x, y: paddlePosition.y + 1 });
    this.ballsCount++;

    this.ballSnap?.detach();
    this.ballSnap = attachPaddleBallSnap(this.paddleEntity, normBall);
  }

  async load(): Promise<void> {
    console.log('[Level1] Loading...');

    setTimeout(() => {
      console.log('[sound]');

      //bgm.play(ASSETS.sounds_10__Darkened_Pursuit_LOOP);
      //sfx.playPitched(ASSETS.sounds_10__Darkened_Pursuit_LOOP);
    }, 1000);

    setTimeout(() => {
      sfx.play(ASSETS.sounds_Rat_Squeak_A);
    }, 1000);

    // Load the world from the RUBE file
    const { loadedBodies, loadedJoints } = loadSceneIntoWorld(Assets.get(ASSETS.level_1_rube), this.context.worldId!);

    this.createBackground();

    const brickDebrisParticles = BrickDebrisParticles().emitter;
    const waterParticles = WaterParticles().emitter;
    const wallParticles = WallParticles().emitter;
    const plusCheeseParticles = PlusCheeseParticles().emitter;
    const plusClayParticles = PlusClayParticles().emitter;

    KeyListener({
      key: 'KeyQ',
      onPress: () => activateCrewMember(0),
    });

    KeyListener({
      key: 'KeyW',
      onPress: () => activateCrewMember(1),
    });

    const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
    assert(paddleJoint, 'Level1: paddle-joint not found in RUBE');

    this.paddleEntity = Paddle({
      jointId: paddleJoint,
      brickDebrisEmitter: brickDebrisParticles,
      plusClayEmitter: plusClayParticles,
      plusCheeseEmitter: plusCheeseParticles,
    });

    this.createBall();

    let door: DoorEntity | undefined = undefined;

    let i = 0;
    let exitExecuted = false;

    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;
      const userData = b2Body_GetUserData(bodyId) as {
        type: string;
        powerup?: BrickPowerUps;
        doorName?: string;
      } | null;
      const tag = userData?.type;

      if (tag === 'brick') {
        if (this.debug_mode && i !== 9) {
          this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);
          i++;
          return;
        }

        const powerUp = userData?.powerup as BrickPowerUps | undefined;
        this.bricksCount++;

        Brick({
          bodyId,
          debrisEmitter: brickDebrisParticles,
          powerUp,
          onBreak: (brick: BrickEntity) => {
            const pos = brick.spawnPos;
            const { x, y } = pos;

            if (brick.powerUp) {
              const t = brick.powerUp;
              if (t === 'blue') {
                BlueCheese({ pos: { x, y } });
              } else if (t === 'green') {
                GreenCheese({ pos: { x, y } });
              } else {
                YellowCheese({ pos: { x, y } });
              }
            } else {
              const random = Math.random();
              if (random < 0.2) {
                YellowCheese({ pos: { x, y } });
              } else if (random < 0.5) {
                Scrap({ pos: { x: x - 0.25, y } });
                Scrap({ pos: { x: x + 0.25, y } });
              } else {
                Scrap({ pos: { x, y } });
              }
            }

            this.bricksCount--;

            if (this.checkWinCondition()) {
              door?.open();
            }
          },
        });

        i++;
      } else if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        const spawnPos = { x: pos.x, y: pos.y };
        this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);

        door = Door({
          spawnPos,
          length: 4,
          sound: ASSETS.sounds_Chest_Open_Creak_3_1,
        });
      } else if (tag === 'left-wall' || tag === 'right-wall' || tag === 'top-wall') {
        Wall({
          bodyId,
          wallCollisionTag: tag,
          onBall: wallSparkOnBall(tag, wallParticles),
        });
      } else if (tag === 'exit') {
        Wall({
          bodyId,
          wallCollisionTag: tag,
          onBall: async () => {
            if (exitExecuted) return;
            exitExecuted = true;
            await execute(Levels_BallExitedLevelCommand);
            this.onWin();
          },
        });
      } else if (tag === 'bottom-wall') {
        Wall({
          bodyId,
          wallCollisionTag: tag,
          onCheese: async ({ cheeseBody }) => {
            const { x, y } = BodyToScreen(cheeseBody.bodyId);
            waterParticles.explode(25, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            cheeseBody.destroy();
          },
          onBall: async ({ ballBody }) => {
            const { x, y } = BodyToScreen(ballBody.bodyId);
            waterParticles.explode(100, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Large_4_2, { volume: 0.25 });

            ballBody.destroy();

            this.ballsCount--;
            if (this.ballsCount === 0) {
              await execute(Levels_LoseBallCommand);

              if (this.checkLoseCondition()) {
                this.onLose();
                return;
              }

              await new Promise((resolve) => setTimeout(resolve, 300));
              this.createBall();
            }
          },
          onScrap: async ({ scrapBody }) => {
            const { x, y } = BodyToScreen(scrapBody.bodyId);
            waterParticles.explode(10, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            scrapBody.destroy();
          },
        });
      } else {
        this.context.systems.get(PhysicsSystem).registerOrphanBody(bodyId);
      }
    });

    await execute(Levels_LevelStartCommand);

    console.log('[Level1] Entities:', getEntities());
    console.log('[Level1] Loaded');
  }

  private createBackground(): void {
    const bg = typedAssets.get<PrototypeTextures>(ASSETS.levels_level_1).textures;

    const map = new TiledResource({
      map: TILED_MAPS.backgrounds_level_1,
      tilesetTextures: {
        level_1_tileset: {
          textures: bg,
          tileIdToFrame: (id) => `level-1_spritesheet_${id}#0`,
        },
      },
    });
    map.load();

    const origin = map.getLayer('meta')?.getObjectsByName('origin')[0];

    if (origin) {
      map.container.x = -origin.x;
      map.container.y = -origin.y;
    }

    map.container.zIndex = -1;

    this.context.container!.addChild(map.container);
  }

  protected checkWinCondition(): boolean {
    return this.bricksCount === 5;
  }

  protected checkLoseCondition(): boolean {
    return getRunState().ballsRemaining.get() <= 0;
  }
}
