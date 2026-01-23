import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { GameEvent } from '@/data/events';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetLinearVelocity,
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
  b2MulSV,
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
import { PhysicsSystem } from '../physics/system';
import { AddSpriteToWorld } from '../physics/WorldSprites';
import { Level } from './Level';
import { BALL_SPEED_DEFAULT } from '@/consts';

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

  paddleBodyId!: b2BodyId;

  ballBodyId!: b2BodyId;
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

  createBall(): void {
    const worldId = this.context.worldId;

    const paddlePosition = b2Body_GetPosition(this.paddleBodyId);

    const { bodyId } = CreateCircle({
      worldId: worldId,
      type: b2BodyType.b2_dynamicBody,
      position: new b2Vec2(paddlePosition.x, paddlePosition.y + 1),
      radius: 0.25,
      density: 10,
      friction: 0.5,
      restitution: 1,
    });

    this.createScrap(paddlePosition.x, paddlePosition.y + 10);

    b2Body_SetUserData(bodyId, { type: 'ball' });
    //b2Body_SetLinearVelocity(bodyId, new b2Vec2(2, 5));

    const ballSprite = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
    ballSprite.anchor.set(0.5, 0.5);
    ballSprite.scale.set(0.75, 0.75);
    this.context.container!.addChild(ballSprite);
    AddSpriteToWorld(this.context.worldId!, ballSprite, bodyId, 0, 0);

    if (this.follow) {
      this.follow.stop();
    }

    /*
    this.follow = follow(this.context.camera, ballSprite, {
      bounds: {
        minX: MIN_WIDTH / 2,
        maxX: MIN_WIDTH / 2,
        minY: 0,
        maxY: MIN_HEIGHT / 2,
      },
    });
    */

    setTimeout(() => {
      //this.context.camera?.setPosition(0, 0);
    }, 2000);

    setTimeout(() => {
      //this.context.camera?.setScale(1.5);
    }, 3000);

    this.registerBody(bodyId);
    this.ballBodyId = bodyId;

    /**/
    this.ballPrismaticJointId = CreatePrismaticJoint({
      worldId: worldId,
      bodyIdA: this.paddleBodyId,
      bodyIdB: this.ballBodyId,
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

  update(delta: number): void {
    super.update(delta);

    // Handle paddle input
    this.updatePaddleInput();

    // Maintain constant ball speed
    // TODO: this should be a method swap
    if (this.shouldMaintainBallSpeed) {
      this.maintainBallSpeed();
    }
  }

  updatePaddleInput(): void {
    // Reset paddle velocity and rotation
    b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(0, 0));
    const transform = b2Body_GetTransform(this.paddleBodyId);
    transform.q.s = 0;
    b2Body_SetTransform(this.paddleBodyId, transform.p, transform.q);

    if (InputDevice.gamepads[0] !== undefined) {
      transform.q.s = 0.1 * InputDevice.gamepads[0]?.leftJoystick.x;
      b2Body_SetTransform(this.paddleBodyId, transform.p, transform.q);
      b2Body_SetLinearVelocity(this.paddleBodyId, new b2Vec2(15 * InputDevice.gamepads[0]?.leftJoystick.x, 0));
    }

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

    if ((InputDevice.gamepads[0]?.button.Face1 || InputDevice.keyboard.key.Space) && !this.shouldMaintainBallSpeed) {
      this.context.systems.get(PhysicsSystem).queueJointDestruction(this.ballPrismaticJointId);
      const ball_position = b2Body_GetPosition(this.ballBodyId);
      const paddle_position = b2Body_GetPosition(this.paddleBodyId);
      const force = 1;

      sfx.play(ASSETS.sounds_Rat_Squeak_A);

      b2Body_ApplyLinearImpulseToCenter(
        this.ballBodyId,
        new b2Vec2(force * (ball_position.x - paddle_position.x), force * (ball_position.y - paddle_position.y)),
        true,
      );
      setTimeout(() => {
        this.shouldMaintainBallSpeed = true;
      }, 100);
    }
  }

  maintainBallSpeed(): void {
    const velocity = b2Body_GetLinearVelocity(this.ballBodyId);
    const speed = Math.max(0.1, Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y));
    const targetSpeed = BALL_SPEED_DEFAULT;

    // Calculate current angle from horizon (in radians, between 0 and PI)
    // (angle from horizontal axis, so angle = atan2(abs(y), abs(x)))
    // unused const absVx = Math.abs(velocity.x);
    const absVy = Math.abs(velocity.y);

    // Prevent perfectly horizontal ball: minddimum angle from horizon = 20deg (in radians)
    const minAngleRad = (30 * Math.PI) / 180;

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
}
