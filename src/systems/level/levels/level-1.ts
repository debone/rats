import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import { GameEvent } from '@/data/events';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { type CollisionPair } from '@/systems/physics/collision-handler';
import { PhysicsSystem } from '@/systems/physics/system';
import { AddSpriteToWorld } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid, b2BodyId, b2JointId } from 'phaser-box2d';
import { GlowFilter } from 'pixi-filters';
import { Assets, Sprite, Texture } from 'pixi.js';
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

  private debug_mode = true;

  constructor() {
    super({
      id: 'level-1',
      name: 'First Level',
      arena: {},
      ballSpeed: 15,
      ballCount: 3,
    });
  }

  async load(): Promise<void> {
    console.log('[Level1] Loading...');

    // Setup collision handlers
    this.setupCollisionHandlers();

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
        if (this.debug_mode && i > 0) {
          this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);
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

    await execute(Level_1_LevelStartCommand);

    console.log('[Level1] Loaded');
  }

  private setupCollisionHandlers(): void {
    // Ball + Brick collision: 'ball' < 'brick', so pair.bodyA = ball, pair.bodyB = brick
    this.collisions.register('ball', 'brick', (pair: CollisionPair) => {
      const brickBody = pair.bodyB;
      // Remove the brick
      this.removeBrick(brickBody);

      if (this.checkWinCondition()) {
        // Level completed
        console.log('[Level1] Level completed!');
        execute(Level_1_DoorOpenCommand, { doors: this.doors });
      }
    });

    this.collisions.register('ball', 'exit', (pair: CollisionPair) => {
      execute(Level_1_BallExitedCommand);
      this.onWin();
    });

    this.collisions.register('ball', 'bottom-wall', async () => {
      console.log('Ball hit bottom wall');

      this.context.systems.get(PhysicsSystem).queueDestruction(this.ballBodyId);
      this.shouldMaintainBallSpeed = false;

      await execute(Level_1_LoseBallCommand);

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
    // Check if ball fell below paddle

    return false;
  }
}
