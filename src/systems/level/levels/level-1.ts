import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { bgm, sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { execute } from '@/core/game/Command';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
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
import { Level_1_BallExitedCommand } from './level-1/BallExitedCommand';
import { Level_1_DoorOpenCommand } from './level-1/DoorOpenCommand';
import { Level_1_LevelStartCommand } from './level-1/LevelStartCommand';
import { Level_1_LoseBallCommand } from './level-1/LoseBallCommand';

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
    this.setupCollisionHandlers();

    setTimeout(() => {
      console.log('[sound]');

      bgm.play(ASSETS.sounds_10__Darkened_Pursuit_LOOP);
      //sfx.playPitched(ASSETS.sounds_10__Darkened_Pursuit_LOOP);
    }, 1000);

    setTimeout(() => {
      sfx.play(ASSETS.sounds_Rat_Squeak_A);
    }, 4000);

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

    await execute(Level_1_LevelStartCommand);

    console.log('[Level1] Loaded');
  }

  private brickDebrisEmitter?: ParticleEmitter;
  private waterEmitter?: ParticleEmitter;
  private wallEmitter?: ParticleEmitter;

  private createParticleEmitters(): void {
    const textures = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

    // Brick debris particle emitter
    this.brickDebrisEmitter = new ParticleEmitter({
      texture: textures['scraps#0'],
      maxParticles: 100,
      lifespan: { min: 200, max: 300 },
      speed: { min: 40, max: 80 },
      angle: { min: -450, max: 225 },
      scale: { start: { min: 0.3, max: 0.6 }, end: 0.2 },
      gravityY: 400,
      rotate: { min: -180, max: 180 },
      x: { min: -16, max: 16 },
      y: { min: -8, max: 8 },
    });

    this.context.container!.addChild(this.brickDebrisEmitter.container);

    // Water particle emitter
    this.waterEmitter = new ParticleEmitter({
      texture: Assets.get(ASSETS.tiles).textures.ball,
      maxParticles: 100,
      lifespan: { min: 200, max: 500 },
      speed: { min: 20, max: 80 },
      angle: { min: -150, max: -30 },
      scale: { min: 0.15, max: 0.25 },
      gravityY: 100,
      tint: 0xff9977,
    });

    this.context.container!.addChild(this.waterEmitter.container);

    // Wall particle emitter
    this.wallEmitter = new ParticleEmitter({
      texture: Assets.get(ASSETS.tiles).textures.ball,
      maxParticles: 100,
      lifespan: { min: 100, max: 700 },
      speed: { min: 20, max: 80 },
      angle: { min: 30, max: -30 },
      scale: { start: { min: 0.15, max: 0.25 }, end: 0 },
      gravityY: 100,
      tint: 0x774444,
    });

    this.context.container!.addChild(this.wallEmitter.container);
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
      if (this.brickDebrisEmitter) {
        const { x, y } = BodyToScreen(brickBody);
        this.brickDebrisEmitter.explode(8, x, y);
      }

      if (Math.random() < 0.5) {
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

    this.collisions.register('ball', 'exit', () => {
      execute(Level_1_BallExitedCommand);
      this.onWin();
    });

    this.collisions.register('ball', 'paddle', async () => {
      sfx.playPitched(ASSETS.sounds_Hit_Jacket_Light_A);
    });

    this.collisions.register('ball', 'left-wall', (pair: CollisionPair) => {
      const ball = pair.bodyA;
      this.wallEmitter!.angle = { min: 30, max: -30 };
      const { x, y } = BodyToScreen(ball);
      this.wallEmitter!.explode(20, x, y);
    });

    this.collisions.register('ball', 'right-wall', (pair: CollisionPair) => {
      const ball = pair.bodyA;
      this.wallEmitter!.angle = { min: 150, max: 210 };
      const { x, y } = BodyToScreen(ball);
      this.wallEmitter!.explode(20, x, y);
    });

    this.collisions.register('ball', 'bottom-wall', async (pair: CollisionPair) => {
      const ball = pair.bodyA;
      console.log('Ball hit bottom wall');

      const { x, y } = BodyToScreen(ball);
      this.waterEmitter!.explode(100, x, y);

      sfx.playPitched(ASSETS.sounds_Splash_Large_4_2);

      this.balls.find((b) => B2_ID_EQUALS(b.bodyId, ball))?.destroy();
      this.balls = this.balls.filter((b) => !B2_ID_EQUALS(b.bodyId, ball));
      this.shouldMaintainBallSpeed = false;

      // TODO: migrate the state to the run state and then make it work here.

      await execute(Level_1_LoseBallCommand);

      if (this.checkLoseCondition()) {
        this.onLose();
        return;
      }

      this.createBall();
    });

    this.collisions.register('bottom-wall', 'scrap', (pair: CollisionPair) => {
      const scrapBody = pair.bodyB;

      const { x, y } = BodyToScreen(scrapBody);
      this.waterEmitter!.explode(10, x, y);

      this.context.systems.get(PhysicsSystem).disableGravity(scrapBody);
      this.context.systems.get(PhysicsSystem).queueDestruction(scrapBody);
    });

    this.collisions.register('paddle', 'scrap', (pair: CollisionPair) => {
      const scrapBody = pair.bodyB;

      const { x, y } = BodyToScreen(scrapBody);
      this.brickDebrisEmitter!.explode(10, x, y + 4);

      getRunState().scrapsCounter.update((value) => {
        value += 1;
        if (value % 5 === 0) {
          this.balls[0].powerUp();
        }
        return value;
      });

      this.context.systems.get(PhysicsSystem).disableGravity(scrapBody);
      this.context.systems.get(PhysicsSystem).queueDestruction(scrapBody);
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
    return this.bricksCount <= 5;
  }

  protected checkLoseCondition(): boolean {
    return getRunState().ballsRemaining.get() <= 0;
  }

  async unload(): Promise<void> {
    await super.unload();

    // Cleanup particle emitters
    this.brickDebrisEmitter?.destroy();
    this.brickDebrisEmitter = undefined;

    this.waterEmitter?.destroy();
    this.waterEmitter = undefined;

    this.wallEmitter?.destroy();
    this.wallEmitter = undefined;
  }
}
