import { GameEvent } from '@/data/events';
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
  b2CreatePolygonShape,
  b2DefaultBodyDef,
  b2DefaultShapeDef,
  b2DestroyBody,
  b2MakeBox,
  b2MulSV,
  b2Normalize,
  b2Shape_GetBody,
  b2Vec2,
  b2World_GetContactEvents,
  b2WorldId,
  CreateBoxPolygon,
  CreateCircle,
} from 'phaser-box2d';
import { InputDevice } from 'pixijs-input-devices';
import { Level } from '../Level';
import { LevelFinishedCommand } from '../commands/LevelFinishedCommand';
import { execute } from '@/core/game/Command';

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
      ballSpeed: 10,
      ballCount: 3,
    });
  }

  async load(): Promise<void> {
    console.log('[Level1] Loading...');

    // Create walls
    this.createWalls();

    // Create paddle (kinematic body controlled by player)
    this.createPaddle();

    // Create ball
    this.createBall();

    // Create a test brick
    this.createBrick();

    console.log('[Level1] Loaded');
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

    // Top wall
    CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(0, arenaHeight * 0.5 - wallThickness * 0.5),
      size: new b2Vec2(arenaWidth * 0.5, wallThickness * 0.5),
      userData: { type: 'top-wall' },
    });

    // Bottom wall
    CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(0, -arenaHeight * 0.5 + wallThickness * 0.5),
      size: new b2Vec2(arenaWidth * 0.5, wallThickness * 0.5),
      userData: { type: 'bottom-wall' },
    });

    // Left wall
    CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(-arenaWidth * 0.5 + wallThickness * 0.5, 0),
      size: new b2Vec2(wallThickness * 0.5, arenaHeight * 0.5),
      userData: { type: 'left-wall' },
    });

    // Right wall
    CreateBoxPolygon({
      ...wallOptions,
      position: new b2Vec2(arenaWidth * 0.5 - wallThickness * 0.5, 0),
      size: new b2Vec2(wallThickness * 0.5, arenaHeight * 0.5),
      userData: { type: 'right-wall' },
    });

    console.log('[Level1] Walls created');
  }

  private createPaddle(): void {
    const worldId = this.context.worldId;

    const { bodyId } = CreateBoxPolygon({
      position: new b2Vec2(0, -20),
      type: b2BodyType.b2_kinematicBody,
      size: new b2Vec2(4, 1),
      density: 10,
      friction: 0.5,
      restitution: 1,
      worldId: worldId,
      userData: { type: 'paddle' },
    });

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

    this.ballBodyId = bodyId;

    console.log('[Level1] Ball created');
  }

  private createBrick(): void {
    const worldId = this.context.worldId;

    // Create a test brick
    CreateBoxPolygon({
      position: new b2Vec2(0, 15),
      type: b2BodyType.b2_staticBody,
      size: new b2Vec2(0.5, 1),
      density: 10,
      friction: 0.7,
      worldId: worldId,
      userData: { type: 'brick' },
    });

    console.log('[Level1] Brick created');
  }

  update(delta: number): void {
    super.update(delta);

    // Handle paddle input
    this.updatePaddleInput();

    // Maintain constant ball speed
    this.maintainBallSpeed();

    this.checkCollisions(this.context.worldId!);
  }

  private checkCollisions(worldId: b2WorldId) {
    const contactEvents = b2World_GetContactEvents(worldId);

    if (contactEvents.beginCount > 0) {
      const events = contactEvents.beginEvents;

      for (let i = 0; i < contactEvents.beginCount; i++) {
        const event = events[i];
        if (!event) continue;

        const shapeIdA = event.shapeIdA;
        const shapeIdB = event.shapeIdB;
        const bodyIdA = b2Shape_GetBody(shapeIdA);
        const bodyIdB = b2Shape_GetBody(shapeIdB);

        if (!b2Body_IsValid(bodyIdA) || !b2Body_IsValid(bodyIdB)) continue;

        const userDataA = b2Body_GetUserData(bodyIdA) as { type: string } | null;
        const userDataB = b2Body_GetUserData(bodyIdB) as { type: string } | null;

        console.log(userDataA, userDataB);

        if (userDataA && userDataB) {
          console.log('Collision detected between', userDataA.type, 'and', userDataB.type);
          if (userDataB.type === 'ball' && userDataA.type === 'brick') {
            console.log('Ball hit brick');

            const position = b2Body_GetPosition(bodyIdA);
            b2DestroyBody(bodyIdA);

            // Emit notification (fire and forget)
            this.context.events.emit(GameEvent.BRICK_DESTROYED, {
              brickId: String(bodyIdA),
              position: { x: position.x, y: position.y },
              score: 100,
            });

            // Execute command for control flow
            execute(LevelFinishedCommand, {
              success: true,
              result: {
                success: true,
                score: 100,
                boonsEarned: [],
                timeElapsed: this.context.level?.elapsedTime || 0,
              },
            });
          }
        }
      }
    }
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

    // Only adjust if speed has drifted significantly
    if (Math.abs(speed - targetSpeed) > 0.1) {
      const normalizedVelocity = b2Normalize(velocity);
      const correctedVelocity = b2MulSV(targetSpeed, normalizedVelocity);
      b2Body_SetLinearVelocity(this.ballBodyId, correctedVelocity);
    }
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
    // TODO: Destroy physics bodies
    // For now, bodies will be cleaned up when world is destroyed
  }
}
