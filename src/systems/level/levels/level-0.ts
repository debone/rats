import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import { getRunState } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { t } from '@/i18n/i18n';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { type CollisionPair } from '@/systems/physics/collision-handler';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import {
  B2_ID_EQUALS,
  b2Body_GetPosition,
  b2Body_GetUserData,
  b2Body_IsValid,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2Vec2,
  CreatePolygon,
} from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { StartingLevels } from '../StartingLevels';
import { Levels_BallExitedLevelCommand } from './commands/BallExitedCommand';
import { Levels_LevelStartCommand } from './commands/LevelStartCommand';
import type { CheeseType } from '@/entities/cheese/Cheese';

export default class Level0 extends StartingLevels {
  static id = 'level-0';

  private doorOpened = 0;

  private blueCheeseBrickPosition: b2Vec2 | null = null;

  constructor() {
    super({
      id: 'level-0',
      name: t.dict['level-0.name'],
    });
  }

  addRawBlueBrick(position: b2Vec2): b2BodyId {
    // Create a paddle body as a custom polygon shape using vertices
    const brickVertices = [new b2Vec2(-0.5, 0.5), new b2Vec2(0.5, 0.5), new b2Vec2(0.5, -0.5), new b2Vec2(-0.5, -0.5)];

    const { bodyId } = CreatePolygon({
      position: new b2Vec2(position.x, position.y),
      type: b2BodyType.b2_staticBody,
      vertices: brickVertices,
      worldId: this.context.worldId!,
    });
    b2Body_SetUserData(bodyId, { type: 'brick', powerup: 'blue' });

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
    this.addBrick(bg[`bricks_tile_1#0`], bodyId, 'blue');

    this.registerBody(bodyId);

    return bodyId;
  }

  async load(): Promise<void> {
    console.log('[Level0] Loading...');

    // Setup collision handlers
    this.registerDefaultCollisionHandlers();
    this.setupCollisionHandlers();
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

    const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');

    // Create paddle (kinematic body controlled by player)
    this.createPaddle(paddleJoint!);

    // Create ball
    this.createBall();

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;
      const userData = b2Body_GetUserData(bodyId) as { type: string; powerup?: BrickPowerUps } | null;
      if (userData?.type === 'brick') {
        const powerUp = userData?.powerup as BrickPowerUps | undefined;

        if (powerUp === 'blue') {
          this.blueCheeseBrickPosition = b2Body_GetPosition(bodyId);
        }

        this.addBrick(bg[`bricks_tile_1#0`], bodyId, powerUp);

        //sprite.filters = [glow];
      } else if (userData?.type === 'door') {
        this.addDoor(bg[`bricks_tile_2#0`], bodyId);
      }

      this.registerBody(bodyId);
    });

    this.createBackground();
    this.createParticleEmitters();

    await execute(Levels_LevelStartCommand);

    console.log('[Level0] Loaded');
  }

  private setupCollisionHandlers(): void {
    // Ball + Brick collision: 'ball' < 'brick', so pair.bodyA = ball, pair.bodyB = brick
    this.collisions.register('ball', 'brick', (pair: CollisionPair) => {
      if (Math.random() < 0.5) {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10);
      } else {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07);
      }

      shake(this.context.camera!, { intensity: Math.random() * 1, duration: 300 });

      const brickBody = pair.bodyB;

      const userData = b2Body_GetUserData(brickBody) as { powerup?: BrickPowerUps } | null;
      const powerUp = userData?.powerup as BrickPowerUps | undefined;

      // Spawn debris particles at brick position
      const { x, y } = BodyToScreen(brickBody);
      this.brickDebrisEmitter!.explode(8, x, y);

      if (powerUp) {
        this.createCheese(b2Body_GetPosition(brickBody).x, b2Body_GetPosition(brickBody).y, powerUp);
      } else {
        this.createScrap(b2Body_GetPosition(brickBody).x - 0.25, b2Body_GetPosition(brickBody).y);
        this.createScrap(b2Body_GetPosition(brickBody).x + 0.25, b2Body_GetPosition(brickBody).y);
      }

      // Remove the brick
      this.removeBrick(brickBody);
    });

    let exitExecuted = false;
    this.collisions.once('ball', 'exit', async () => {
      if (exitExecuted) return;
      exitExecuted = true;
      await execute(Levels_BallExitedLevelCommand);
      this.onWin();
    });

    this.collisions.replaceRegister('cheese', 'paddle', (pair: CollisionPair) => {
      const cheeseBody = pair.bodyA;

      const userData = b2Body_GetUserData(cheeseBody) as { cheeseType?: CheeseType } | null;
      const cheeseType = userData?.cheeseType as CheeseType | undefined;

      if (cheeseType === 'blue') {
        this.doorOpened++;
      }
    });

    this.collisions.replaceRegister('bottom-wall', 'cheese', (pair: CollisionPair) => {
      const cheeseBody = pair.bodyB;

      const { x, y } = BodyToScreen(cheeseBody);
      this.waterEmitter!.explode(20, x, y);

      this.addRawBlueBrick(this.blueCheeseBrickPosition!);

      this.context.systems.get(PhysicsSystem).disableGravity(cheeseBody);
      this.context.systems.get(PhysicsSystem).queueDestruction(cheeseBody);
    });

    this.collisions.register('ball', 'bottom-wall', async (pair: CollisionPair) => {
      const ball = pair.bodyA;
      console.log('Ball hit bottom wall');

      const { x, y } = BodyToScreen(ball);
      this.waterEmitter!.explode(100, x, y);

      sfx.playPitched(ASSETS.sounds_Splash_Large_4_2);

      // Cleaning up this specific ball, not all
      this.balls.find((b) => B2_ID_EQUALS(b.bodyId, ball))?.destroy();
      this.balls = this.balls.filter((b) => !B2_ID_EQUALS(b.bodyId, ball));

      if (this.balls.length === 0) {
        this.shouldMaintainBallSpeed = false;

        await new Promise((resolve) => setTimeout(resolve, 300));

        this.createBall();
      }
    });
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
