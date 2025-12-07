import { ASSETS } from '@/assets';
import { execute } from '@/core/game/Command';
import { GameEvent } from '@/data/events';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { type CollisionPair } from '@/systems/physics/collision-handler';
import {
  b2Body_GetLinearVelocity,
  b2Body_GetPosition,
  b2Body_GetTransform,
  b2Body_SetLinearVelocity,
  b2Body_SetTransform,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2CreatePolygonShape,
  b2CreatePrismaticJoint,
  b2DefaultBodyDef,
  b2DefaultPrismaticJointDef,
  b2DefaultShapeDef,
  b2MakeBox,
  b2MulSV,
  b2Normalize,
  b2Vec2,
  CreateBoxPolygon,
  CreateCircle,
} from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';
import { LevelFinishedCommand } from '../commands/LevelFinishedCommand';
import { Level } from '../Level';

/**
 * Level 1 - Tutorial/First Level
 * Simple breakout-style level with basic mechanics
 */
export default class Level1 extends Level {
  static id = 'level-1';

  private paddleBodyId!: b2BodyId;
  private ballBodyId!: b2BodyId;

  constructor() {
    super({
      id: 'level-1',
      name: 'First Level',
      arena: {
        width: 35,
        height: 66,
      },
      ballSpeed: 15,
      ballCount: 3,
    });
  }

  async load(): Promise<void> {
    console.log('[Level1] Loading...');

    // Setup collision handlers
    this.setupCollisionHandlers();

    // Create walls
    this.createWalls();

    // Create paddle (kinematic body controlled by player)
    this.createPaddle();

    // Create ball
    this.createBall();

    // Create a test brick
    this.createBrick();

    // Load the world from the RUBE file
    const { loadedBodies } = loadSceneIntoWorld(Assets.get(ASSETS.level_1_rube), this.context.worldId!);

    loadedBodies.forEach((bodyId) => {
      this.addBody(bodyId);
    });

    console.log('[Level1] Loaded');
  }

  /**
   * Setup collision handlers for this level.
   * Handlers are registered with type pairs - the pair is normalized alphabetically.
   */
  private setupCollisionHandlers(): void {
    // Ball + Brick collision: 'ball' < 'brick', so pair.bodyA = ball, pair.bodyB = brick
    this.collisions.register('ball', 'brick', (pair: CollisionPair) => {
      const brickBody = pair.bodyB;
      const position = b2Body_GetPosition(brickBody);

      // Queue destruction (don't destroy during iteration)
      this.collisions.queueDestruction(brickBody);

      // Emit notification (fire and forget)
      this.context.events.emit(GameEvent.BRICK_DESTROYED, {
        brickId: String(brickBody),
        position: { x: position.x, y: position.y },
        score: 100,
      });
    });

    this.collisions.register('ball', 'top-wall', () => {
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

    this.collisions.register('ball', 'bottom-wall', () => {
      console.log('Ball hit bottom wall');
      execute(LevelFinishedCommand, {
        success: false,
        result: {
          success: false,
          score: 0,
          boonsEarned: [],
          timeElapsed: this.context.level?.elapsedTime || 0,
        },
      });
    });
  }

  private createWalls(): void {
    const worldId = this.context.worldId;
    console.log('[Level1] Creating walls...', worldId);
    const { width: arenaWidth, height: arenaHeight } = this.config.arena;

    // Create a static body for all walls
    const wallsBodyDef = b2DefaultBodyDef();
    wallsBodyDef.type = b2BodyType.b2_staticBody;
    wallsBodyDef.position = new b2Vec2(0, 0);

    // Wall properties
    const wallShapeDef = b2DefaultShapeDef();
    wallShapeDef.density = 10;
    wallShapeDef.restitution = 1;
    wallShapeDef.friction = 0;

    const wallThickness = 1;

    const wallOptions = {
      worldId: worldId,
      shapeDef: wallShapeDef,
      bodyDef: wallsBodyDef,
    };

    /*
    // Top wall
    const { bodyId: topWallBodyId } = CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(0, arenaHeight * 0.5 - wallThickness * 0.5),
      size: new b2Vec2(arenaWidth * 0.5, wallThickness * 0.5),
      userData: { type: 'top-wall' },
    });

    // Bottom wall
    const { bodyId: bottomWallBodyId } = CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(0, -arenaHeight * 0.5 + wallThickness * 0.5),
      size: new b2Vec2(arenaWidth * 0.5, wallThickness * 0.5),
      userData: { type: 'bottom-wall' },
    });

    // Left wall
    const { bodyId: leftWallBodyId } = CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(-arenaWidth * 0.5 + wallThickness * 0.5, 0),
      size: new b2Vec2(wallThickness * 0.5, arenaHeight * 0.5),
      userData: { type: 'left-wall' },
    });

    // Right wall
    const { bodyId: rightWallBodyId } = CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(arenaWidth * 0.5 - wallThickness * 0.5, 0),
      size: new b2Vec2(wallThickness * 0.5, arenaHeight * 0.5),
      userData: { type: 'right-wall' },
    });

    this.addBody(topWallBodyId);
    this.addBody(bottomWallBodyId);
    this.addBody(leftWallBodyId);
    this.addBody(rightWallBodyId);
*/
    console.log('[Level1] Walls created');
  }

  private createPaddle(): void {
    const worldId = this.context.worldId;

    const { bodyId: anchorBodyId } = CreateBoxPolygon({
      position: new b2Vec2(0, -33),
      type: b2BodyType.b2_staticBody,
      size: new b2Vec2(0.5, 0.5),
      density: 10,
      friction: 0.5,
      restitution: 1,
      worldId: worldId,
      userData: { type: 'anchor' },
    });

    const { bodyId } = CreateBoxPolygon({
      position: new b2Vec2(0, -30),
      type: b2BodyType.b2_dynamicBody,
      size: new b2Vec2(4, 1),
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
    prismaticJointDef2.localAnchorA = new b2Vec2(0, 3);
    prismaticJointDef2.enableLimit = true;
    prismaticJointDef2.lowerTranslation = -12;
    prismaticJointDef2.upperTranslation = 12;
    b2CreatePrismaticJoint(worldId, prismaticJointDef2);

    this.addBody(bodyId);
    this.paddleBodyId = bodyId;

    console.log('[Level1] Paddle created');
  }

  private createBall(): void {
    const worldId = this.context.worldId;

    const { bodyId } = CreateCircle({
      worldId: worldId,
      type: b2BodyType.b2_dynamicBody,
      position: new b2Vec2(0, -18),
      radius: 0.5,
      density: 10,
      friction: 0.5,
      restitution: 1,
    });

    // Wall properties
    const wallShapeDef = b2DefaultShapeDef();
    wallShapeDef.density = 0;
    wallShapeDef.restitution = 0;
    wallShapeDef.friction = 0;

    b2CreatePolygonShape(bodyId, wallShapeDef, b2MakeBox(0.1, 0.4));
    b2CreatePolygonShape(bodyId, wallShapeDef, b2MakeBox(0.4, 0.1));

    b2Body_SetUserData(bodyId, { type: 'ball' });
    b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, 5));

    this.addBody(bodyId);
    this.ballBodyId = bodyId;

    console.log('[Level1] Ball created');
  }

  private createBrick(): void {
    const worldId = this.context.worldId;

    // Create a test brick
    const { bodyId } = CreateBoxPolygon({
      position: new b2Vec2(0, -3),
      type: b2BodyType.b2_staticBody,
      size: new b2Vec2(0.5, 1),
      density: 10,
      friction: 0.7,
      worldId,
      userData: { type: 'brick' },
    });

    this.addBody(bodyId);

    console.log('[Level1] Brick created');
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
    const absVx = Math.abs(velocity.x);
    const absVy = Math.abs(velocity.y);

    // Prevent perfectly vertical ball: minimum angle from horizon = 20deg (in radians)
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
    // For now, simple test: destroy the brick to win
    // TODO: Implement proper brick destruction detection
    return false; // Placeholder
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

  async unload(): Promise<void> {
    console.log('[Level1] Unloading...');
    this.collisions.clear();
    // TODO: Destroy physics bodies
    // For now, bodies will be cleaned up when world is destroyed
  }
}
