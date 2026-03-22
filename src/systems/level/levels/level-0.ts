import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { getEntities, type AttachHandle } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import { GameEvent } from '@/data/events';
import { activateCrewMember, getRunState } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { t } from '@/i18n/i18n';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { Paddle, type PaddleEntity } from '@/systems/level/levels/level-0/Paddle';
import { Wall, wallSparkOnBall } from '@/systems/level/levels/level-0/Wall';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid, b2BodyId, b2JointId } from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';
import { StartingLevels } from '../StartingLevels';

import { assert } from '@/core/common/assert';
import { ENTITY_KINDS } from '@/core/entity/entity-kinds';
import { getEntitiesOfKind } from '@/core/entity/known-entities';
import { state } from '@/core/state/state';
import { Levels_BallExitedLevelCommand } from './commands/BallExitedCommand';
import { Levels_LevelStartCommand } from './commands/LevelStartCommand';
import { attachPaddleBallSnap } from './level-0/attachments/paddleBallSnap';
import { attachCaptainBoost } from './level-0/attachments/paddleCaptainBoost';
import { Brick, type BrickEntity } from './level-0/Brick';
import { BlueCheese, GreenCheese, YellowCheese } from './level-0/Cheese';
import { Door, type DoorEntity } from './level-0/Door';
import { NormBall } from './level-0/NormBall';
import { Scrap } from './level-0/Scrap';

export default class Level0 extends StartingLevels {
  static id = 'level-0';

  private paddleEntity?: PaddleEntity;

  private ballSnap?: AttachHandle<{ launch: () => void; jointId: b2JointId }>;
  private captainBoostHandle?: { detach: () => void };

  constructor() {
    super({
      id: 'level-0',
      name: t.dict['level-0.name'],
    });
  }

  /** Level-0: `attachPaddleBallSnap` + `attachBallLaunchInput`; keeps `ballPrismaticJointId` for base typings. */
  createBall(): void {
    assert(this.paddleEntity, 'Level0 createBall: paddleEntity must be defined');

    const paddlePosition = b2Body_GetPosition(this.paddleEntity.bodyId);
    const normBall = NormBall({ x: paddlePosition.x, y: paddlePosition.y + 1 });
    this.ballsCount++;

    this.ballSnap?.detach();
    this.ballSnap = attachPaddleBallSnap(this.paddleEntity, normBall);
  }

  /**
   * Level-0: doubler unchanged; captain uses `attachCaptainBoost` instead of base `speedBoat`.
   * Does not call `StartingLevels.setupEventListeners` to avoid duplicate captain handling.
   */
  setupEventListeners(): void {
    this.eventCleanups.push(
      this.context.events.on(GameEvent.POWERUP_DOUBLER, () => {
        console.log('[Level0] Powerup: doubler');
        getEntitiesOfKind(ENTITY_KINDS.normBall).forEach((ball) => {
          const position = b2Body_GetPosition(ball.bodyId);
          const newBall = NormBall({ x: position.x, y: position.y });
          newBall.startUpdating();
        });
        this.doubleBalls();
      }),
    );

    this.eventCleanups.push(
      this.context.events.on(GameEvent.POWERUP_CAPTAIN, () => {
        console.log('[Level0] Powerup: captain');
        if (!this.paddleEntity) return;
        this.captainBoostHandle?.detach();
        this.captainBoostHandle = attachCaptainBoost(this.paddleEntity);
      }),
    );
  }

  /** Level-0: crew keys only — movement + ball launch live on `Paddle` + attachments. */
  updatePaddleInput(): void {
    if (InputDevice.keyboard.key.KeyQ && !this.isQDown) {
      this.isQDown = true;
      this.lastQDownTime = performance.now();
      activateCrewMember(0);
    } else if (!InputDevice.keyboard.key.KeyQ && this.isQDown) {
      const timeDown = performance.now() - this.lastQDownTime;
      if (timeDown > 50) {
        this.isQDown = false;
      }
    }

    if (InputDevice.keyboard.key.KeyW && !this.isWDown) {
      this.isWDown = true;
      this.lastWDownTime = performance.now();
      activateCrewMember(1);
    } else if (!InputDevice.keyboard.key.KeyW && this.isWDown) {
      const timeDown = performance.now() - this.lastWDownTime;
      if (timeDown > 50) {
        this.isWDown = false;
      }
    }
  }

  private ballsCount = 0;

  async load(): Promise<void> {
    console.log('[Level0] Loading...');

    //this.registerDefaultCollisionHandlers();
    this.setupEventListeners();

    setTimeout(() => {
      console.log('[sound]');

      //bgm.play(ASSETS.sounds_10__Darkened_Pursuit_LOOP);
      //sfx.playPitched(ASSETS.sounds_10__Darkened_Pursuit_LOOP);
    }, 1000);

    setTimeout(() => {
      sfx.play(ASSETS.sounds_Rat_Squeak_A);
    }, 1000);

    // Load the world from the RUBE file
    const { loadedBodies, loadedJoints } = loadSceneIntoWorld(
      Assets.get(ASSETS.levels_level_0_rube),
      this.context.worldId!,
    );

    this.createBackground();
    this.createParticleEmitters();

    // Create paddle (kinematic body controlled by player)
    const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
    this.paddleEntity = Paddle({ jointId: paddleJoint!, brickDebrisEmitter: this.brickDebrisEmitter! });

    // Create ball
    this.createBall();

    let doorA: DoorEntity | undefined = undefined;
    let doorB: DoorEntity | undefined = undefined;
    let doorBCheeseLeft = 5;
    let doorC: DoorEntity | undefined = undefined;

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
        const powerUp = userData?.powerup as BrickPowerUps | undefined;
        this.bricksCount++;

        if (powerUp) {
          let brickBodyId: b2BodyId | undefined = bodyId;
          let brickSpawnPos: { x: number; y: number } = b2Body_GetPosition(bodyId);
          let brickSpawnX = brickSpawnPos.x;
          let brickSpawnY = brickSpawnPos.y;

          const Cheese = powerUp === 'blue' ? BlueCheese : powerUp === 'green' ? GreenCheese : YellowCheese;

          const done =
            powerUp === 'blue'
              ? () => {
                  doorA?.open();
                }
              : powerUp === 'green'
                ? () => {
                    doorC?.open();
                  }
                : () => {
                    doorBCheeseLeft--;
                    if (doorBCheeseLeft === 0) {
                      doorB?.open();
                    }
                  };

          state(
            {
              brick: (transition) => {
                this.bricksCount++;

                Brick({
                  bodyId: brickBodyId,
                  spawnPos: { x: brickSpawnX, y: brickSpawnY },
                  debrisEmitter: this.brickDebrisEmitter!,
                  powerUp,
                  onBreak: () => {
                    this.bricksCount--;
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
                done?.();
              },
            },
            'brick',
          );
        } else {
          Brick({
            powerUp,
            bodyId,
            debrisEmitter: this.brickDebrisEmitter!,
            onBreak: (brick: BrickEntity) => {
              Scrap({
                pos: { x: brick.spawnPos.x - 0.25, y: brick.spawnPos.y },
              });

              Scrap({
                pos: { x: brick.spawnPos.x + 0.25, y: brick.spawnPos.y },
              });

              this.bricksCount--;
            },
          });
        }
      } else if (tag === 'left-wall' || tag === 'right-wall' || tag === 'top-wall') {
        Wall({
          bodyId,
          wallCollisionTag: tag,
          onBall: wallSparkOnBall(tag, this.wallEmitter!),
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
            this.waterEmitter!.explode(25, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Large_4_2);
            cheeseBody.destroy();
          },
          onBall: async ({ ballBody }) => {
            const { x, y } = BodyToScreen(ballBody.bodyId);
            this.waterEmitter!.explode(100, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Large_4_2);

            ballBody.destroy();

            this.ballsCount--;
            if (this.ballsCount === 0) {
              await new Promise((resolve) => setTimeout(resolve, 300));
              this.createBall();
            }
          },
          onScrap: async ({ scrapBody }) => {
            const { x, y } = BodyToScreen(scrapBody.bodyId);
            this.waterEmitter!.explode(10, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Large_4_2);
            scrapBody.destroy();
          },
        });
      } else if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        const spawnPos = { x: pos.x, y: pos.y };
        this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);

        const door = Door({
          spawnPos,
          length: 2,
        });

        if (userData?.doorName === 'door-a') {
          doorA = door;
        } else if (userData?.doorName === 'door-b') {
          doorB = door;
          doorB.openingDirection = 'right';
        } else if (userData?.doorName === 'door-c') {
          doorC = door;
        }
      } else {
        this.registerBody(bodyId);
      }
    });

    setTimeout(() => {
      throw new Error(
        "just keeping this error here so I don't forget that I'm not registering all the physics bodies anymore and even though I have the unmounts and such, I don't call it.",
      );
    }, 30_000);

    await execute(Levels_LevelStartCommand);

    const entities = getEntities();

    console.log('[Level0] Entities:', entities);

    console.log('[Level0] Loaded');
  }

  private createBackground(): void {
    const bg = typedAssets.get<PrototypeTextures>(ASSETS.levels_level_1).textures;

    const map = new TiledResource({
      map: TILED_MAPS.backgrounds_level_0,
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

    // TIL the zindex is relative to the container
    map.container.zIndex = -1;
    // FIXME: lol, why the whole "background" thing?

    this.context.container!.addChild(map.container);
    // ?? this.context.layers?.background.addChild(map.container);
  }

  protected checkWinCondition(): boolean {
    return this.bricksCount === 5;
  }

  protected checkLoseCondition(): boolean {
    return getRunState().ballsRemaining.get() <= 0;
  }
}
