import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { type CollisionPair } from '@/systems/physics/collision-handler';
import { PhysicsSystem } from '@/systems/physics/system';
import { GetSpriteFromBody } from '@/systems/physics/WorldSprites';
import { b2Body_GetUserData, b2Body_IsValid, b2Body_SetUserData } from 'phaser-box2d';
import { Assets, Sprite } from 'pixi.js';
import { StartingLevels } from '../StartingLevels';
import { Level_2_BallExitedCommand } from './level-2/BallExitedCommand';
import { Level_2_DoorOpenCommand } from './level-2/DoorOpenCommand';
import { Level_2_LevelStartCommand } from './level-2/LevelStartCommand';
import { Level_2_LoseBallCommand } from './level-2/LoseBallCommand';
import { getRunState } from '@/data/game-state';
import { t } from '@/i18n/i18n';

export default class Level2 extends StartingLevels {
  static id = 'level-2';

  private debug_mode = false;

  constructor() {
    super({
      id: 'level-2',
      name: t.dict['level-2.name'],
    });
  }

  async load(): Promise<void> {
    console.log('[Level2] Loading...');

    // Setup collision handlers
    this.setupCollisionHandlers();

    // Load the world from the RUBE file
    const { loadedBodies, loadedJoints } = loadSceneIntoWorld(Assets.get(ASSETS.level_2_rube), this.context.worldId!);

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

        b2Body_SetUserData(bodyId, { type: 'brick', life: 1 });
        this.addBrick(bg[`bricks_tile_1#0`], bodyId);

        i++;
      } else if (userData?.type === 'strong-brick') {
        if (this.debug_mode && i > 0) {
          this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);
          return;
        }

        b2Body_SetUserData(bodyId, { type: 'strong-brick', life: 2 });
        this.addBrick(bg[`bricks_tile_3#0`], bodyId);
        i++;
      } else if (userData?.type === 'door') {
        this.addDoor(bg[`bricks_tile_2#0`], bodyId);
      }

      this.registerBody(bodyId);
    });

    this.createBackground();

    await execute(Level_2_LevelStartCommand);

    console.log('[Level2] Loaded');
  }

  private createBackground(): void {
    const bg = typedAssets.get<PrototypeTextures>(ASSETS.levels_level_1).textures;

    const map = new TiledResource({
      map: TILED_MAPS.backgrounds_level_2,
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

  /**
   * Setup collision handlers for this level.
   * Handlers are registered with type pairs - the pair is normalized alphabetically.
   */
  private setupCollisionHandlers(): void {
    // Ball + Brick collision: 'ball' < 'brick', so pair.bodyA = ball, pair.bodyB = brick
    this.collisions.register('ball', 'brick', (pair: CollisionPair) => {
      const brickBody = pair.bodyB;
      // Remove the brick
      this.removeBrick(brickBody);

      if (this.checkWinCondition()) {
        // Level completed
        console.log('[Level2] Level completed!');
        execute(Level_2_DoorOpenCommand, { doors: this.doors });
      }
    });

    this.collisions.register('ball', 'strong-brick', (pair: CollisionPair) => {
      const brickBody = pair.bodyB;
      const life = pair.userDataB.life as number;

      if (life > 1) {
        const sprite = GetSpriteFromBody(this.context.worldId!, brickBody);
        if (sprite) {
          const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
          (sprite as Sprite).texture = bg[`bricks_tile_4#0`];
        }
        b2Body_SetUserData(brickBody, { ...pair.userDataB, life: life - 1 });
      } else {
        // Remove the brick
        this.removeBrick(brickBody);

        if (this.checkWinCondition()) {
          // Level completed
          console.log('[Level2] Level completed!');
          execute(Level_2_DoorOpenCommand, { doors: this.doors });
        }
      }
    });

    this.collisions.register('ball', 'exit', (_pair: CollisionPair) => {
      execute(Level_2_BallExitedCommand, { level: this });
    });

    this.collisions.register('ball', 'bottom-wall', async () => {
      console.log('Ball hit bottom wall');

      this.context.systems.get(PhysicsSystem).queueDestruction(this.ballBodyId);
      this.shouldMaintainBallSpeed = false;

      await execute(Level_2_LoseBallCommand);

      if (this.checkLoseCondition()) {
        this.onLose();
        return;
      }

      this.createBall();
    });
  }

  protected checkWinCondition(): boolean {
    return this.bricksCount <= 0;
  }

  protected checkLoseCondition(): boolean {
    return getRunState().ballsRemaining.get() <= 0;
  }
}
