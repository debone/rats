import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { bgm, sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { execute } from '@/core/game/Command';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { TiledResource } from '@/core/tiled';
import { getRunState } from '@/data/game-state';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { type CollisionPair } from '@/systems/physics/collision-handler';
import { PhysicsSystem } from '@/systems/physics/system';
import { WorldToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid } from 'phaser-box2d';
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
  private brickDebrisEmitter?: ParticleEmitter;

  constructor() {
    super({
      id: 'level-1',
      name: 'First Level',
      arena: {},
      ballSpeed: 13,
      ballCount: 3,
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

  private createParticleEmitters(): void {
    const textures = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

    // Brick debris particle emitter
    this.brickDebrisEmitter = new ParticleEmitter({
      texture: textures['bricks_tile_1#0'],
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
  }

  private setupCollisionHandlers(): void {
    // Ball + Brick collision: 'ball' < 'brick', so pair.bodyA = ball, pair.bodyB = brick
    this.collisions.register('ball', 'brick', (pair: CollisionPair) => {
      if (Math.random() < 0.5) {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10);
      } else {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07);
      }

      shake(this.context.camera!, { intensity: 1, duration: 300 });

      const brickBody = pair.bodyB;

      // Spawn debris particles at brick position
      if (this.brickDebrisEmitter) {
        const pos = b2Body_GetPosition(brickBody);
        const { x, y } = WorldToScreen(pos.x, pos.y);
        this.brickDebrisEmitter.explode(8, x + MIN_WIDTH / 2, y + MIN_HEIGHT / 2);
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

    this.collisions.register('ball', 'bottom-wall', async () => {
      console.log('Ball hit bottom wall');

      sfx.playPitched(ASSETS.sounds_Splash_Large_4_2);

      this.context.systems.get(PhysicsSystem).queueDestruction(this.ballBodyId);
      this.shouldMaintainBallSpeed = false;

      // TODO: migrate the state to the run state and then make it work here.

      await execute(Level_1_LoseBallCommand);

      if (this.checkLoseCondition()) {
        this.onLose();
        return;
      }

      this.createBall();
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

    map.container.zIndex = -1;

    this.context.container!.addChild(map.container);
  }

  protected checkWinCondition(): boolean {
    return this.bricksCount <= 0;
  }

  protected checkLoseCondition(): boolean {
    return getRunState().ballsRemaining.get() <= 0;
  }

  async unload(): Promise<void> {
    await super.unload();

    // Cleanup particle emitters
    this.brickDebrisEmitter?.destroy();
    this.brickDebrisEmitter = undefined;
  }
}
