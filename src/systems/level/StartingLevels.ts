import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { GameEvent } from '@/data/events';
import { activateCrewMember, getRunState, swapCrewMembers } from '@/data/game-state';
import type { Ball } from '@/entities/balls/Ball';
import { NormalBall } from '@/entities/balls/NormalBall';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetPosition,
  b2Body_GetTransform,
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
  b2Normalize,
  b2PrismaticJoint_GetLowerLimit,
  b2PrismaticJoint_GetUpperLimit,
  b2Vec2,
  CreateBoxPolygon,
  CreateCircle,
  CreatePrismaticJoint,
} from 'phaser-box2d';
import { Assets, Sprite, Texture } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';
import type { CollisionPair } from '../physics/collision-handler';
import { PhysicsSystem } from '../physics/system';
import { AddSpriteToWorld, BodyToScreen } from '../physics/WorldSprites';
import { Level } from './Level';

/** Configuration for a level */
export interface LevelConfig {
  id: string;
  name: string;
  arena: {};
  ballSpeed?: number;
  ballCount?: number;
}

/**
 * Base class for all levels
 */
export abstract class StartingLevels extends Level {
  doors: b2BodyId[] = [];
  bricksCount = 0;

  balls: Ball[] = [];

  paddleBodyId!: b2BodyId;
  paddleSprite!: Sprite;

  ballPrismaticJointId!: b2JointId;

  shouldMaintainBallSpeed: boolean = false;

  createPaddle(jointId: b2JointId): void {
    const worldId = this.context.worldId;

    const anchorBodyId = b2Joint_GetBodyA(jointId);
    const tempBodyId = b2Joint_GetBodyB(jointId);

    const pos = b2Body_GetPosition(tempBodyId);

    const { bodyId } = CreateBoxPolygon({
      position: new b2Vec2(pos.x, pos.y),
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
    this.paddleSprite = paddleSprite;

    console.log('[Level1] Paddle created');
  }

  createScrap(x: number, y: number): void {
    const worldId = this.context.worldId;

    const { bodyId } = CreateCircle({
      worldId: worldId,
      type: b2BodyType.b2_dynamicBody,
      position: new b2Vec2(x, y),
      radius: 0.3,
      density: 1,
      friction: 0.5,
      restitution: 0,
    });

    b2Body_SetUserData(bodyId, { type: 'scrap' });
    const scrapSprite = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['scraps#0'],
      scale: Math.random() * 0.3 + 0.8,
    });
    scrapSprite.anchor.set(0.5, 0.5);
    this.context.container!.addChild(scrapSprite);
    AddSpriteToWorld(this.context.worldId!, scrapSprite, bodyId, 0, 0);
    this.registerBody(bodyId);
    let f = new b2Vec2(Math.random() * 1 - 0.5, Math.random() * 1 - 0.5);
    b2Normalize(f);
    b2Body_ApplyLinearImpulseToCenter(bodyId, f, true);
    this.context.systems.get(PhysicsSystem).enableGravity(bodyId);
  }

  createCheese(x: number, y: number): void {
    const worldId = this.context.worldId;

    const { bodyId } = CreateCircle({
      worldId: worldId,
      type: b2BodyType.b2_dynamicBody,
      position: new b2Vec2(x, y),
      radius: 0.3,
      density: 1,
      friction: 0.5,
      restitution: 0,
    });

    b2Body_SetUserData(bodyId, { type: 'cheese' });
    const cheeseSprite = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures['cheese_tile_1#0'],
    });
    cheeseSprite.anchor.set(0.5, 0.5);
    this.context.container!.addChild(cheeseSprite);
    AddSpriteToWorld(this.context.worldId!, cheeseSprite, bodyId, 0, 0);
    this.registerBody(bodyId);
    let f = new b2Vec2(Math.random() * 1 - 0.5, Math.random() * 1 - 0.5);
    b2Normalize(f);
    b2Body_ApplyLinearImpulseToCenter(bodyId, f, true);
    this.context.systems.get(PhysicsSystem).enableGravity(bodyId);
  }

  createBall(): void {
    const worldId = this.context.worldId;

    const paddlePosition = b2Body_GetPosition(this.paddleBodyId);

    const ball = new NormalBall(this.context, paddlePosition.x, paddlePosition.y + 1);

    this.registerBody(ball.bodyId);
    this.balls.push(ball);

    // TODO: "SNAP" into boat
    // boat.snap(ball)
    /**/
    this.ballPrismaticJointId = CreatePrismaticJoint({
      worldId: worldId,
      bodyIdA: this.paddleBodyId,
      bodyIdB: ball.bodyId,
      anchorA: new b2Vec2(0, 0.7),
      anchorB: new b2Vec2(0, 0),
      axis: new b2Vec2(1, 0),
      enableLimit: true,
      lowerTranslation: -1.75,
      upperTranslation: 1.75,
    }).jointId;
    /**/

    console.log('[Level1] Ball created');
  }

  addDoor(texture: Texture, bodyId: b2BodyId): void {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    this.context.container!.addChild(sprite);
    AddSpriteToWorld(this.context.worldId!, sprite, bodyId);
    this.registerBody(bodyId);
    this.doors.push(bodyId);
  }

  addBrick(texture: Texture, bodyId: b2BodyId): void {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    this.context.container!.addChild(sprite);
    AddSpriteToWorld(this.context.worldId!, sprite, bodyId);
    this.registerBody(bodyId);
    this.bricksCount++;
  }

  removeBrick(bodyId: b2BodyId): void {
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

  registerDefaultCollisionHandlers(): void {
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

    this.collisions.register('cheese', 'paddle', (pair: CollisionPair) => {
      activateCrewMember();

      const cheeseBody = pair.bodyA;

      this.context.systems.get(PhysicsSystem).disableGravity(cheeseBody);
      this.context.systems.get(PhysicsSystem).queueDestruction(cheeseBody);
    });

    this.collisions.register('bottom-wall', 'cheese', (pair: CollisionPair) => {
      const cheeseBody = pair.bodyB;

      const { x, y } = BodyToScreen(cheeseBody);
      this.waterEmitter!.explode(20, x, y);

      this.context.systems.get(PhysicsSystem).disableGravity(cheeseBody);
      this.context.systems.get(PhysicsSystem).queueDestruction(cheeseBody);
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

      getRunState().scrapsCounter.update((value) => value + 1);

      this.context.systems.get(PhysicsSystem).disableGravity(scrapBody);
      this.context.systems.get(PhysicsSystem).queueDestruction(scrapBody);
    });
  }

  setupEventListeners(): void {
    this.eventCleanups.push(
      this.context.events.on(GameEvent.POWERUP_ACTIVATED, (payload) => {
        console.log('[Level1] Powerup activated:', payload.type);
        switch (payload.type) {
          case 'faster':
            for (let i = 0; i < this.balls.length; i++) {
              this.balls[i].powerUp();
            }
            break;
          case 'doubler':
            this.doubleBalls();
            break;
          case 'captain':
            this.speedBoat();
            break;
        }
      }),
    );
  }

  protected brickDebrisEmitter?: ParticleEmitter;
  protected waterEmitter?: ParticleEmitter;
  protected wallEmitter?: ParticleEmitter;

  protected createParticleEmitters(): void {
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

  ballsToIncrease = 0;

  increaseBallCount(): void {
    let ballsLength = this.balls.length;
    for (let ballsIncreased = 0; ballsIncreased <= Math.min(5, this.ballsToIncrease); ballsIncreased++) {
      const ballPosition = b2Body_GetPosition(this.balls[Math.floor(Math.random() * ballsLength)].bodyId);
      const ball = new NormalBall(this.context, ballPosition.x, ballPosition.y);
      this.registerBody(ball.bodyId);
      this.balls.push(ball);
      this.ballsToIncrease--;
    }
  }

  doubleBalls(): void {
    let maxBalls = this.balls.length;
    if (maxBalls > 50) {
      return;
    }
    this.ballsToIncrease += maxBalls;
  }

  update(delta: number): void {
    super.update(delta);

    if (this.ballsToIncrease > 0) {
      this.increaseBallCount();
    }

    // Handle paddle input
    this.updatePaddleInput();

    // Maintain constant ball speed
    // TODO: this should be a method swap
    if (this.shouldMaintainBallSpeed || this.balls.length > 1) {
      for (let i = 0; i < this.balls.length; i++) {
        this.balls[i].update(delta);
      }
    }

    if (this.timeoutSpeedBoat > 0) {
      this.timeoutSpeedBoat -= delta;
      if (this.timeoutSpeedBoat <= 0) {
        this.slowBoat();
      }
    }
  }

  private boatForce = 0;
  private maxSpeed = 15;

  private timeoutSpeedBoat = 0;
  speedBoat(): void {
    this.timeoutSpeedBoat = 15000;
    this.maxSpeed = 23;
    this.paddleSprite.tint = 0xffff00;
  }

  private slowBoat(): void {
    this.timeoutSpeedBoat = 1000;
    this.maxSpeed = 15;
    this.paddleSprite.tint = 0xffffff;
  }

  updatePaddleInput(): void {
    // Reset paddle velocity and rotation
    b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(0, 0));
    const transform = b2Body_GetTransform(this.paddleBodyId);
    transform.q.s = 0;
    b2Body_SetTransform(this.paddleBodyId, transform.p, transform.q);

    // Handle arrow key input
    if (InputDevice.keyboard.key.ArrowLeft) {
      this.boatForce = Math.max(this.boatForce - 0.1, -1);
    } else if (InputDevice.keyboard.key.ArrowRight) {
      this.boatForce = Math.min(this.boatForce + 0.1, 1);
    } else {
      if (this.boatForce > 0) {
        this.boatForce = Math.max(this.boatForce - 0.2, 0);
      } else {
        this.boatForce = Math.min(this.boatForce + 0.2, 0);
      }
    }

    if (InputDevice.gamepads[0] !== undefined) {
      this.boatForce = InputDevice.gamepads[0]?.leftJoystick.x;
    }

    if (this.boatForce !== 0) {
      transform.q.s = this.boatForce * 0.25;
      b2Body_SetTransform(this.paddleBodyId, transform.p, transform.q);
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(this.boatForce * this.maxSpeed, 0));
    }

    if (InputDevice.keyboard.key.ArrowUp) {
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(0, 10));
    }

    if (InputDevice.keyboard.key.ArrowDown) {
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(0, -10));
    }

    if ((InputDevice.gamepads[0]?.button.Face1 || InputDevice.keyboard.key.Space) && !this.shouldMaintainBallSpeed) {
      const ball = this.balls[0];
      this.context.systems.get(PhysicsSystem).queueJointDestruction(this.ballPrismaticJointId);
      const ball_position = b2Body_GetPosition(ball.bodyId);
      const paddle_position = b2Body_GetPosition(this.paddleBodyId);

      sfx.play(ASSETS.sounds_Rat_Squeak_A);

      const x = ball_position.x - paddle_position.x;
      const y = ball_position.y - paddle_position.y;

      setTimeout(() => {
        b2Body_SetLinearVelocity(ball.bodyId, new b2Vec2(x, y));
      }, 0);

      this.shouldMaintainBallSpeed = true;
    }

    if (InputDevice.keyboard.key.KeyX && !this.isXDown) {
      this.isXDown = true;
      this.lastXDownTime = performance.now();
      swapCrewMembers();
    } else if (!InputDevice.keyboard.key.KeyX && this.isXDown) {
      const timeDown = performance.now() - this.lastXDownTime;
      if (timeDown > 300) {
        this.isXDown = false;
      }
    }
  }

  isXDown: boolean = false;
  lastXDownTime: number = 0;

  async unload(): Promise<void> {
    await super.unload();

    this.brickDebrisEmitter?.destroy();
    this.brickDebrisEmitter = undefined;

    this.waterEmitter?.destroy();
    this.waterEmitter = undefined;

    this.wallEmitter?.destroy();
    this.wallEmitter = undefined;
  }
}
