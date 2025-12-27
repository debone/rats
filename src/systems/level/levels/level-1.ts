import { ASSETS, TILED_MAPS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import { GameEvent } from '@/data/events';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { type CollisionPair } from '@/systems/physics/collision-handler';
import { PhysicsSystem } from '@/systems/physics/system';
import { AddSpriteToWorld } from '@/systems/physics/WorldSprites';
import {
  b2Body_GetLinearVelocity,
  b2Body_GetPosition,
  b2Body_GetTransform,
  b2Body_GetUserData,
  b2Body_IsValid,
  b2Body_SetLinearVelocity,
  b2Body_SetTransform,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2CreatePrismaticJoint,
  b2DefaultPrismaticJointDef,
  b2DestroyBody,
  b2DestroyJoint,
  b2Joint_GetBodyA,
  b2Joint_GetBodyB,
  b2Joint_GetLocalAnchorA,
  b2Joint_GetLocalAnchorB,
  b2JointId,
  b2MulSV,
  b2Normalize,
  b2PrismaticJoint_GetLowerLimit,
  b2PrismaticJoint_GetUpperLimit,
  b2Vec2,
  CreateBoxPolygon,
  CreateCircle,
} from 'phaser-box2d';
import { GlowFilter } from 'pixi-filters';
import { Assets, Sprite, Texture } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';
import { Level } from '../Level';
import { Level_1_BallExitedCommand } from './level-1/BallExitedCommand';
import { Level_1_LevelStartCommand } from './level-1/LevelStartCommand';
import { Level_1_LoseBallCommand } from './level-1/LoseBallCommand';

/**
 * Level 1 - Tutorial/First Level
 * Simple breakout-style level with basic mechanics
 */
export default class Level1 extends Level {
  static id = 'level-1';

  private paddleBodyId!: b2BodyId;
  private ballBodyId!: b2BodyId;

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

    // Create ball
    this.createBall();

    // Load the world from the RUBE file
    const { loadedBodies, loadedJoints } = loadSceneIntoWorld(Assets.get(ASSETS.level_1_rube), this.context.worldId!);

    const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');

    // Create paddle (kinematic body controlled by player)
    this.createPaddle(paddleJoint!);

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

    const glow = new GlowFilter({
      distance: 1,
      outerStrength: 0.5,
      innerStrength: 0,
      color: 0xffffaa,
      quality: 0.5,
    });

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

  private doors: b2BodyId[] = [];
  private addDoor(texture: Texture, bodyId: b2BodyId): void {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    this.context.container!.addChild(sprite);
    AddSpriteToWorld(this.context.worldId!, sprite, bodyId);
    this.registerBody(bodyId);
    this.doors.push(bodyId);
  }

  private bricksCount = 0;
  // TODO: bricks count by type

  private addBrick(texture: Texture, bodyId: b2BodyId): void {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    this.context.container!.addChild(sprite);
    AddSpriteToWorld(this.context.worldId!, sprite, bodyId);
    this.registerBody(bodyId);
    this.bricksCount++;
  }

  private removeBrick(bodyId: b2BodyId): void {
    const position = b2Body_GetPosition(bodyId);

    // Emit notification (fire and forget)
    this.context.events.emit(GameEvent.BRICK_DESTROYED, {
      brickId: String(bodyId),
      position: { x: position.x, y: position.y },
      score: 100,
    });

    // Queue destruction (don't destroy during iteration)
    this.context.systems.get(PhysicsSystem).queueDestruction(bodyId);
    this.unregisterBody(bodyId);
    this.bricksCount--;
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
        console.log('[Level1] Level completed!');
        //execute(Level_1_DoorOpenCommand, { doors: this.doors });
        execute(Level_1_BallExitedCommand, { level: this });
      }
    });

    this.collisions.register('ball', 'exit', (pair: CollisionPair) => {
      execute(Level_1_BallExitedCommand, { level: this });
    });

    /*this.collisions.register('ball', 'top-wall', () => {
      console.log('Ball hit top wall');
      execute(LevelFinishedCommand, {
        success: true,
        result: {
          success: true,
          score: 100,
          boonsEarned: [],
          timeElapsed: this.context.level?.elapsedTime || 0,
        },
      });
    });
*/
    this.collisions.register('ball', 'bottom-wall', () => {
      console.log('Ball hit bottom wall');
      execute(Level_1_LoseBallCommand);
    });
  }

  private createPaddle(jointId: b2JointId): void {
    const worldId = this.context.worldId;

    const anchorBodyId = b2Joint_GetBodyA(jointId);
    const tempBodyId = b2Joint_GetBodyB(jointId);

    const pos = b2Body_GetPosition(tempBodyId);

    const { bodyId } = CreateBoxPolygon({
      position: new b2Vec2(pos.x + 5, pos.y),
      type: b2BodyType.b2_dynamicBody,
      size: new b2Vec2(2, 0.5),
      density: 10,
      friction: 0.5,
      restitution: 1,
      worldId: worldId,
      userData: { type: 'paddle' },
    });

    const prismaticJointDef2 = b2DefaultPrismaticJointDef();
    prismaticJointDef2.bodyIdA = anchorBodyId;
    prismaticJointDef2.bodyIdB = bodyId;
    prismaticJointDef2.collideConnected = false;
    prismaticJointDef2.localAnchorA = b2Joint_GetLocalAnchorA(jointId).clone();
    prismaticJointDef2.localAnchorB = b2Joint_GetLocalAnchorB(jointId).clone();
    prismaticJointDef2.enableLimit = true;
    prismaticJointDef2.lowerTranslation = b2PrismaticJoint_GetLowerLimit(jointId);
    prismaticJointDef2.upperTranslation = b2PrismaticJoint_GetUpperLimit(jointId);
    b2CreatePrismaticJoint(worldId, prismaticJointDef2);

    b2DestroyJoint(jointId);
    b2DestroyBody(tempBodyId);

    const paddleSprite = new Sprite(Assets.get(ASSETS.entities_rats).textures['rat-boat#0']);
    paddleSprite.anchor.set(0.5, 0);
    this.context.container!.addChild(paddleSprite);
    AddSpriteToWorld(this.context.worldId!, paddleSprite, bodyId, 0, -34);

    this.registerBody(bodyId);
    this.paddleBodyId = bodyId;

    console.log('[Level1] Paddle created');
  }

  private createBall(): void {
    const worldId = this.context.worldId;

    const { bodyId } = CreateCircle({
      worldId: worldId,
      type: b2BodyType.b2_dynamicBody,
      position: new b2Vec2(0, -15),
      radius: 0.25,
      density: 10,
      friction: 0.5,
      restitution: 1,
    });

    b2Body_SetUserData(bodyId, { type: 'ball' });
    b2Body_SetLinearVelocity(bodyId, new b2Vec2(2, 5));

    const ballSprite = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
    ballSprite.anchor.set(0.5, 0.5);
    ballSprite.scale.set(0.75, 0.75);
    this.context.container!.addChild(ballSprite);
    AddSpriteToWorld(this.context.worldId!, ballSprite, bodyId, 0, 0);

    this.registerBody(bodyId);
    this.ballBodyId = bodyId;

    console.log('[Level1] Ball created');
  }

  update(delta: number): void {
    super.update(delta);

    // Handle paddle input
    this.updatePaddleInput();

    // Maintain constant ball speed
    this.maintainBallSpeed();
  }

  private updatePaddleInput(): void {
    // Reset paddle velocity and rotation
    b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(0, 0));
    const transform = b2Body_GetTransform(this.paddleBodyId);
    transform.q.s = 0;
    b2Body_SetTransform(this.paddleBodyId, transform.p, transform.q);

    // Handle arrow key input
    if (InputDevice.keyboard.key.ArrowLeft) {
      transform.q.s = -0.1;
      b2Body_SetTransform(this.paddleBodyId, transform.p, transform.q);
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(-10, 0));
    }

    if (InputDevice.keyboard.key.ArrowRight) {
      transform.q.s = 0.1;
      b2Body_SetTransform(this.paddleBodyId, transform.p, transform.q);
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(10, 0));
    }

    if (InputDevice.keyboard.key.ArrowUp) {
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(0, 10));
    }

    if (InputDevice.keyboard.key.ArrowDown) {
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(0, -10));
    }
  }

  private maintainBallSpeed(): void {
    const velocity = b2Body_GetLinearVelocity(this.ballBodyId);
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const targetSpeed = this.config.ballSpeed || 10;

    // Calculate current angle from horizon (in radians, between 0 and PI)
    // (angle from horizontal axis, so angle = atan2(abs(y), abs(x)))
    // unused const absVx = Math.abs(velocity.x);
    const absVy = Math.abs(velocity.y);

    // Prevent perfectly vertical ball: minddimum angle from horizon = 20deg (in radians)
    const minAngleRad = (20 * Math.PI) / 180;

    let newVelocity = { x: velocity.x, y: velocity.y };

    // If the ball is too horizontal (the angle from the x-axis to the velocity is less than minAngleRad)
    if (speed > 0.0001 && absVy / speed < Math.sin(minAngleRad)) {
      // Clamp the direction to minAngleRad from the horizon
      // Keep the sign of x and y the same as original velocity
      const signX = Math.sign(velocity.x) || 1;
      const signY = Math.sign(velocity.y) || 1;

      // Calculate new velocity components with the constrained angle
      // vx = speed * cos(minAngleRad)
      // vy = speed * sin(minAngleRad)
      const clampedVx = Math.cos(minAngleRad) * speed * signX;
      const clampedVy = Math.sin(minAngleRad) * speed * signY;

      newVelocity = { x: clampedVx, y: clampedVy };
    } else {
      // Optionally adjust to targetSpeed as original
      if (Math.abs(speed - targetSpeed) > 0.1) {
        const normalizedVelocity = b2Normalize(velocity);
        newVelocity = b2MulSV(targetSpeed, normalizedVelocity);
      }
    }
    b2Body_SetLinearVelocity(this.ballBodyId, new b2Vec2(newVelocity.x, newVelocity.y));
  }

  protected checkWinCondition(): boolean {
    return this.bricksCount <= 0;
  }

  protected checkLoseCondition(): boolean {
    // Check if ball fell below paddle
    const ballTransform = b2Body_GetTransform(this.ballBodyId);
    const ballY = ballTransform.p.y;

    if (ballY < -35) {
      // Ball fell off screen
      if (this.context.level) {
        this.context.level.ballsRemaining--;
      }
      return this.context.level ? this.context.level.ballsRemaining <= 0 : true;
    }

    return false;
  }
}
