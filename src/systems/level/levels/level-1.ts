import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import { getRunState } from '@/data/game-state';
import { t } from '@/i18n/i18n';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { type CollisionPair } from '@/systems/physics/collision-handler';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { B2_ID_EQUALS, b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid } from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { StartingLevels } from '../StartingLevels';
import { Levels_BallExitedLevelCommand } from './commands/BallExitedCommand';
import { Level_1_DoorOpenCommand } from './commands/Level1_DoorOpenCommand';
import { Levels_LevelStartCommand } from './commands/LevelStartCommand';
import { Levels_LoseBallCommand } from './commands/LoseBallCommand';

/**
 * Level 1 - Tutorial/First Level
 * Simple breakout-style level with basic mechanics
 */
export default class Level1 extends StartingLevels {
  static id = 'level-1';

  private debug_mode = false;

  constructor() {
    super({
      id: 'level-1',
      name: t.dict['level-1.name'],
    });
  }

  async load(): Promise<void> {
    console.log('[Level1] Loading...');

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
    const { loadedBodies, loadedJoints } = loadSceneIntoWorld(Assets.get(ASSETS.level_1_rube), this.context.worldId!);

    const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');

    // Create paddle (kinematic body controlled by player)
    this.createPaddle(paddleJoint!);

    // Create ball
    this.createBall();

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
    let i = 0;

    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;
      const userData = b2Body_GetUserData(bodyId) as { type: string } | null;
      if (userData?.type === 'brick') {
        if (this.debug_mode && i !== 9) {
          this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);
          i++;
          return;
        }

        this.addBrick(bg[`bricks_tile_1#0`], bodyId);

        //sprite.filters = [glow];
        i++;
      } else if (userData?.type === 'door') {
        this.addDoor(bg[`bricks_tile_2#0`], bodyId);
      }

      this.registerBody(bodyId);
    });

    this.createBackground();
    this.createParticleEmitters();

    await execute(Levels_LevelStartCommand);

    console.log('[Level1] Loaded');
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

      // Spawn debris particles at brick position
      const { x, y } = BodyToScreen(brickBody);
      this.brickDebrisEmitter!.explode(8, x, y);

      const random = Math.random();
      if (random < 0.2) {
        this.createCheese(b2Body_GetPosition(brickBody).x, b2Body_GetPosition(brickBody).y);
      } else if (random < 0.5) {
        this.createScrap(b2Body_GetPosition(brickBody).x - 0.25, b2Body_GetPosition(brickBody).y);
        this.createScrap(b2Body_GetPosition(brickBody).x + 0.25, b2Body_GetPosition(brickBody).y);
      } else {
        this.createScrap(b2Body_GetPosition(brickBody).x, b2Body_GetPosition(brickBody).y);
      }

      // Remove the brick
      this.removeBrick(brickBody);

      if (this.checkWinCondition()) {
        // Level completed
        console.log('[Level1] Level completed!');
        execute(Level_1_DoorOpenCommand, { doors: this.doors });
      }
    });

    this.collisions.once('ball', 'exit', async () => {
      await execute(Levels_BallExitedLevelCommand);
      this.onWin();
    });

    this.collisions.register('ball', 'bottom-wall', async (pair: CollisionPair) => {
      const ball = pair.bodyA;
      console.log('Ball hit bottom wall');

      const { x, y } = BodyToScreen(ball);
      this.waterEmitter!.explode(100, x, y);

      sfx.playPitched(ASSETS.sounds_Splash_Large_4_2);

      this.balls.find((b) => B2_ID_EQUALS(b.bodyId, ball))?.destroy();
      this.balls = this.balls.filter((b) => !B2_ID_EQUALS(b.bodyId, ball));
      // TODO: migrate the state to the run state and then make it work here.
      if (this.balls.length === 0) {
        this.shouldMaintainBallSpeed = false;

        await execute(Levels_LoseBallCommand);

        if (this.checkLoseCondition()) {
          this.onLose();
          return;
        }

        this.createBall();
      }
    });
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
