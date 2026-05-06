import { ASSETS } from '@/assets';
import { BALL_SPEED_DEFAULT } from '@/consts';
import { getEntitiesOf } from '@/core/entity/entity';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { signal } from '@/core/reactivity/signals/signals';
import { GameEvent } from '@/data/events';
import { getRunState } from '@/data/game-state';
import { useBodySprite, useCollisionHandler, useGameEvent, usePhysics, useUpdate, useWorldId } from '@/hooks/hooks';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetLinearVelocity,
  b2Body_GetPosition,
  b2Body_SetLinearVelocity,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2MakeRot,
  b2MulSV,
  b2Normalize,
  b2RotateVector,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
  b2Vec2,
  CreateCircle,
} from 'phaser-box2d';
import { Assets, Sprite } from 'pixi.js';
import { Paddle } from './Paddle';

export interface NormBallEntity extends EntityBase {
  bodyId: b2BodyId;
  sprite: Sprite;
  active: boolean;
  baseSpeed: number;
  startUpdating(): void;
  stopUpdating(): void;
}

export interface NormBallProps {
  x: number;
  y: number;
}

const f = signal(0, {
  label: 'nudge force',
  tweakpaneOptions: { readonly: true, bufferSize: 1000, interval: 100, view: 'graph', min: 0, max: 1 },
});

export const NormBall = defineEntity(({ x, y }: NormBallProps) => {
  const worldId = useWorldId();
  const physics = usePhysics();

  const { bodyId, shapeId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(x, y),
    radius: 0.25,
    density: 10,
    friction: 0.5,
    restitution: 1,
  });

  const ballFilter = b2Shape_GetFilter(shapeId);
  ballFilter.categoryBits = 0x0002;
  b2Shape_SetFilter(shapeId, ballFilter);

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  b2Body_SetUserData(bodyId, { type: 'ball' });

  const ballSprite = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
  ballSprite.anchor.set(0.5, 0.5);
  ballSprite.scale.set(0.75, 0.75);
  useBodySprite(ballSprite, bodyId!);

  let timeout = 0;

  let speedRatio = getRunState().stats.ballSpeedRatio.get();
  getRunState().stats.ballSpeedRatio.subscribe((v) => {
    speedRatio = v;
  });

  /*
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
*/

  let nudge = false;
  getRunState().crewBoons.flub_ballsAttractedToBoat.subscribe((value) => {
    nudge = value;
  });

  const { start, stop } = useUpdate((delta) => {
    timeout -= delta;
    if (timeout <= 0) {
      //powerDown();
    }

    // Flub passive: gentle horizontal attraction toward paddle
    if (nudge) {
      const paddles = getEntitiesOf(Paddle);
      if (paddles.length > 0) {
        const paddlePos = b2Body_GetPosition(paddles[0].bodyId);
        const ballPos = b2Body_GetPosition(bodyId);
        const dx = paddlePos.x - ballPos.x;
        const sign = Math.sign(dx);
        const boost = Math.max(0, (5 - Math.abs(dx)) * 0.05);
        const finalForce = Math.abs(dx) * 0.05 + boost;
        f.set(boost);
        const impulse = new b2Vec2(sign * finalForce, 0);
        b2Body_ApplyLinearImpulseToCenter(bodyId, impulse, true);
      }
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
    } else if (Math.abs(speed - normBall.baseSpeed) > 0.01) {
      const normalizedVelocity = b2Normalize(velocity);
      newVelocity = b2MulSV(speedRatio * normBall.baseSpeed, normalizedVelocity);
    }

    b2Body_SetLinearVelocity(bodyId, new b2Vec2(newVelocity.x, newVelocity.y));
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'ball',
    handlers: {},
    entity: normBall,
  }));

  useGameEvent(GameEvent.CREW_DOUBLE_BALLS, () => {
    const velocity = b2Body_GetLinearVelocity(bodyId);

    if (!normBall.active) {
      return;
    }

    const position = b2Body_GetPosition(bodyId);
    const newBall = NormBall({ x: position.x, y: position.y });
    newBall.startUpdating();

    const rotatedVelocity = b2RotateVector(b2MakeRot(Math.PI), velocity);

    queueMicrotask(() => {
      b2Body_SetLinearVelocity(newBall.bodyId, rotatedVelocity);
    });
  });

  const normBall = entity<NormBallEntity>({
    active: false,
    bodyId,
    sprite: ballSprite,
    baseSpeed: BALL_SPEED_DEFAULT,
    startUpdating: () => {
      normBall.active = true;
      start();
    },
    stopUpdating: () => {
      normBall.active = false;
      stop();
    },
  });

  return normBall;
});
