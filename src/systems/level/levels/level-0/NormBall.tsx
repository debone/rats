import { ASSETS } from '@/assets';
import { BALL_SPEED_DEFAULT } from '@/consts';
import { ENTITY_KINDS, type EntityBase } from '@/core/entity/entity-kinds';
import { defineEntity, getUnmount, mountEffect, onCleanup } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { useBodySprite, useCollisionHandler, usePhysics, useUpdate, useWorldId } from '@/hooks/hooks';
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

export interface NormBallEntity extends EntityBase<typeof ENTITY_KINDS.normBall> {
  bodyId: b2BodyId;
  sprite: Sprite;
  startUpdating(): void;
  stopUpdating(): void;
  destroy(): void;
}

export interface NormBallProps {
  x: number;
  y: number;
}

export const NormBall = defineEntity(({ x, y }: NormBallProps): NormBallEntity => {
  const worldId = useWorldId();
  const unmount = getUnmount();
  const physics = usePhysics();

  const { bodyId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(x, y),
    radius: 0.25,
    density: 10,
    friction: 0.5,
    restitution: 1,
  });

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  b2Body_SetUserData(bodyId, { type: 'ball' });

  const ballSprite = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
  ballSprite.anchor.set(0.5, 0.5);
  ballSprite.scale.set(0.75, 0.75);
  useBodySprite(ballSprite, bodyId!);

  let timeout = 0;
  let targetSpeed = BALL_SPEED_DEFAULT;

  function powerUp() {
    timeout = 10000;
    ballSprite.tint = 0xffff00;
    targetSpeed = BALL_SPEED_DEFAULT * 2;
  }

  function powerDown() {
    timeout = 0;
    ballSprite.tint = 0xffffff;
    targetSpeed = BALL_SPEED_DEFAULT;
  }

  const { start, stop } = useUpdate((delta) => {
    timeout -= delta;
    if (timeout <= 0) {
      powerDown();
    }

    const velocity = b2Body_GetLinearVelocity(bodyId);
    const speed = Math.max(0.1, Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y));
    const absVy = Math.abs(velocity.y);

    const minAngleRad = (15 * Math.PI) / 180;

    let newVelocity = { x: velocity.x, y: velocity.y };

    if (speed > 0.0001 && absVy / speed < Math.sin(minAngleRad)) {
      const signX = Math.sign(velocity.x) || 1;
      const signY = Math.sign(velocity.y) || 1;
      const clampedVx = Math.cos(minAngleRad) * speed * signX;
      const clampedVy = Math.sin(minAngleRad) * speed * signY;
      newVelocity = { x: clampedVx, y: clampedVy };
    } else if (Math.abs(speed - targetSpeed) > 0.01) {
      const normalizedVelocity = b2Normalize(velocity);
      newVelocity = b2MulSV(targetSpeed, normalizedVelocity);
    }

    b2Body_SetLinearVelocity(bodyId, new b2Vec2(newVelocity.x, newVelocity.y));
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'ball',
    handlers: {},
    entity: normBall,
  }));

  mountEffect(() => {
    return getGameContext().events.on(GameEvent.POWERUP_FASTER, () => {
      powerUp();
    });
  });

  const normBall: NormBallEntity = {
    kind: ENTITY_KINDS.normBall,
    bodyId,
    sprite: ballSprite,
    startUpdating: start,
    stopUpdating: stop,
    destroy() {
      unmount();
    },
  };

  return normBall;
});
