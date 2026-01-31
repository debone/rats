import { ASSETS } from '@/assets';
import { BALL_SPEED_DEFAULT } from '@/consts';
import type { GameContext } from '@/data/game-context';
import { PhysicsSystem } from '@/systems/physics/system';
import { AddSpriteToWorld } from '@/systems/physics/WorldSprites';
import {
  b2Body_GetLinearVelocity,
  b2Body_SetLinearVelocity,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2MulSV,
  b2Normalize,
  b2Vec2,
  CreateCircle,
} from 'phaser-box2d';
import { Assets, Sprite } from 'pixi.js';
import type { Ball } from './Ball';

export class VerticalBall implements Ball {
  bodyId: b2BodyId;
  sprite: Sprite;

  targetSpeed: number = BALL_SPEED_DEFAULT;

  constructor(
    private context: GameContext,
    x: number,
    y: number,
  ) {
    const worldId = this.context.worldId!;

    const { bodyId } = CreateCircle({
      worldId: worldId,
      type: b2BodyType.b2_dynamicBody,
      position: new b2Vec2(x, y),
      radius: 0.25,
      density: 10,
      friction: 0.5,
      restitution: 1,
    });

    b2Body_SetUserData(bodyId, { type: 'ball' });

    const ballSprite = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
    ballSprite.anchor.set(0.5, 0.5);
    ballSprite.scale.set(0.75, 0.75);
    this.context.container!.addChild(ballSprite);
    AddSpriteToWorld(worldId, ballSprite, bodyId);

    this.bodyId = bodyId;
    this.sprite = ballSprite;

    console.log('[VerticalBall] Ball created');
  }

  timeout: number = 0;

  powerUp(): void {
    this.targetSpeed = BALL_SPEED_DEFAULT * 2;
    this.sprite.tint = 0xffff00;
    this.timeout = 10000;
  }

  powerDown(): void {
    this.targetSpeed = BALL_SPEED_DEFAULT;
    this.sprite.tint = 0xffffff;
  }

  update(delta: number): void {
    this.timeout -= delta;
    if (this.timeout <= 0) {
      this.powerDown();
    }

    const velocity = b2Body_GetLinearVelocity(this.bodyId);
    const speed = Math.max(0.1, Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y));

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
      if (Math.abs(speed - this.targetSpeed) > 0.01) {
        const normalizedVelocity = b2Normalize(velocity);
        newVelocity = b2MulSV(this.targetSpeed, normalizedVelocity);
      }
    }
    b2Body_SetLinearVelocity(this.bodyId, new b2Vec2(newVelocity.x, newVelocity.y));
  }

  destroy(): void {
    this.context.systems.get(PhysicsSystem).queueDestruction(this.bodyId);
  }
}
