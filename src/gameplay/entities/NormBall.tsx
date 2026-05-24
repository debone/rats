import { ASSETS } from '@/assets';
import { BALL_SPEED_DEFAULT } from '@/consts';
import { defineEntity, entity, getEntitiesOf, onCleanup, type EntityBase } from '@/core/entity/scope';
import { signal } from '@/core/reactivity/signals/signals';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { useBodySprite, useCollisionHandler, useGameEvent, usePhysics, useUpdate, useWorldId } from '@/hooks/hooks';
import { EntityCollisionSystem } from '@/systems/physics/EntityCollisionSystem';
import { BALL_MASK_GHOST, BALL_MASK_NORMAL, PhysicsLayer } from '@/systems/physics/PhysicsLayers';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetLinearVelocity,
  b2Body_GetPosition,
  b2Body_GetUserData,
  b2Body_SetLinearVelocity,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2DefaultQueryFilter,
  b2MakeRot,
  b2MulSV,
  b2Normalize,
  b2Rot,
  b2RotateVector,
  b2Shape_GetBody,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
  b2ShapeId,
  b2Sub,
  b2Transform,
  b2UnwindAngle,
  b2Vec2,
  b2World_OverlapCircle,
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
  const ctx = getGameContext();
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
  ballFilter.categoryBits = PhysicsLayer.BALL;
  ballFilter.maskBits = BALL_MASK_NORMAL;
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

  let nudge = false;
  getRunState().crewBoons.flub_ballsAttractedToBoat.subscribe((value) => {
    nudge = value;
  });

  let unstoppableBall = false;
  getRunState().crewBoons.panterat_unstoppableBall.subscribe((value) => {
    unstoppableBall = value;
  });

  getRunState().crewBoons.ratfather_ghostBalls.subscribe((value) => {
    const filter = b2Shape_GetFilter(shapeId);
    filter.maskBits = value ? BALL_MASK_GHOST : BALL_MASK_NORMAL;
    b2Shape_SetFilter(shapeId, filter);
  });

  const entityCollisions = ctx.systems.get(EntityCollisionSystem);

  // Snapshot of the ball's corrected velocity from the previous frame end.
  // This represents the direction the ball "intended" to travel going into the
  // physics step, and is used to restore direction after an unstoppable-mode
  // brick collision (Box2D reflects the velocity during the step; we undo that).
  let priorVelocity = new b2Vec2(0, 0);

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

    // Snapshot the corrected velocity so the brick collision handler can restore
    // it when the ball is in unstoppable mode.
    priorVelocity.x = newVelocity.x;
    priorVelocity.y = newVelocity.y;
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'ball',
    handlers: {
      'strong-brick': (_ball, brick) => {
        if (!unstoppableBall) return;
        brick.hit(100);
        // Restore pre-step velocity: Box2D has already reflected the ball off
        b2Body_SetLinearVelocity(bodyId, new b2Vec2(priorVelocity.x, priorVelocity.y));
      },
      brick: (_ball, _brick) => {
        if (!unstoppableBall) return;
        // Restore pre-step velocity: Box2D has already reflected the ball off
        b2Body_SetLinearVelocity(bodyId, new b2Vec2(priorVelocity.x, priorVelocity.y));
      },
    },
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

  useGameEvent(GameEvent.CREW_RECALL_BALLS, () => {
    const paddles = getEntitiesOf(Paddle);
    if (paddles.length === 0) {
      return;
    }

    const paddlePos = b2Body_GetPosition(paddles[0].bodyId);
    const ballPos = b2Body_GetPosition(bodyId);

    // Rotate the ball's velocity so it points toward the paddle
    const delta = b2Sub(paddlePos, ballPos);
    const targetAngle = Math.atan2(delta.y, delta.x);
    const velocity = b2Body_GetLinearVelocity(bodyId);
    const currentAngle = Math.atan2(velocity.y, velocity.x);
    const rotation = b2UnwindAngle(targetAngle - currentAngle);
    const newVelocity = b2RotateVector(b2MakeRot(rotation), velocity);

    b2Body_SetLinearVelocity(bodyId, newVelocity);
  });

  useGameEvent(GameEvent.CREW_EXPLODE_BALLS, () => {
    const BALL_EXPLODE_RADIUS = 2.5;
    const damage = getRunState().stats.ballDamage.get();
    const position = b2Body_GetPosition(bodyId);

    b2World_OverlapCircle(
      worldId,
      {
        center: [position],
        radius: BALL_EXPLODE_RADIUS,
      },
      new b2Transform(new b2Vec2(position.x, position.y), new b2Rot(0)),
      b2DefaultQueryFilter(),
      (shapeId: b2ShapeId) => {
        const body = b2Shape_GetBody(shapeId);
        const userData = b2Body_GetUserData(body) as { type: 'brick' | 'strong-brick' };
        if (userData.type === 'brick') {
          entityCollisions.get(body)?.entity.hit();
        }
        if (userData.type === 'strong-brick') {
          entityCollisions.get(body)?.entity.hit(damage);
        }
      },
      null,
    );

    ctx.events.emit(GameEvent.BALL_LOST);
    normBall.destroy();
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
