import { ASSETS } from '@/assets';
import { BALL_SPEED_DEFAULT } from '@/consts';
import { getEntitiesOfKind } from '@/core/entity/entity';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getRunState } from '@/data/game-state';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useBodySprite, useCollisionHandler, useGameEvent, usePhysics, useUpdate, useWorldId } from '@/hooks/hooks';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetLinearVelocity,
  b2Body_GetPosition,
  b2Body_SetLinearVelocity,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2MulSV,
  b2Normalize,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
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

/** Prevents multiple balls from spawning on a single CREW_SPAWN_BALL event. */
let _spawnBallLock = false;

export const NormBall = defineEntity(({ x, y }: NormBallProps): NormBallEntity => {
  const worldId = useWorldId();
  const unmount = getUnmount();
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

  let hasteBoosted = false;
  let hasteTimer = 0;
  let ghostTimer = 0;
  let explosiveTimer = 0;
  let stickyTimer = 0;

  let speedRatio = getRunState().stats.ballSpeedRatio.get();
  getRunState().stats.ballSpeedRatio.subscribe((v) => {
    speedRatio = v;
  });

  function getTargetSpeed() {
    if (hasteBoosted) return BALL_SPEED_DEFAULT * 2 * speedRatio;
    return BALL_SPEED_DEFAULT * speedRatio;
  }

  function setHaste(duration: number) {
    hasteBoosted = true;
    hasteTimer = duration;
    ballSprite.tint = 0xffff00;
  }

  function clearHaste() {
    hasteBoosted = false;
    hasteTimer = 0;
    ballSprite.tint = ghostTimer > 0 ? 0x8888ff : 0xffffff;
  }

  function setGhost() {
    ghostTimer = 2000;
    ballSprite.tint = 0x8888ff;
    const f = b2Shape_GetFilter(shapeId);
    f.maskBits = 0xffff & ~0x0001; // exclude default category (bricks/walls)
    b2Shape_SetFilter(shapeId, f);
  }

  function clearGhost() {
    const f = b2Shape_GetFilter(shapeId);
    f.maskBits = 0xffff;
    b2Shape_SetFilter(shapeId, f);
    ballSprite.tint = hasteBoosted ? 0xffff00 : 0xffffff;
  }

  const { start, stop } = useUpdate((delta) => {
    if (hasteTimer > 0) {
      hasteTimer -= delta;
      if (hasteTimer <= 0) clearHaste();
    }

    if (ghostTimer > 0) {
      ghostTimer -= delta;
      if (ghostTimer <= 0) clearGhost();
    }

    if (explosiveTimer > 0) {
      explosiveTimer -= delta;
      if (explosiveTimer <= 0) {
        ballSprite.tint = hasteBoosted ? 0xffff00 : 0xffffff;
      }
    }

    if (stickyTimer > 0) {
      stickyTimer -= delta;
      if (stickyTimer <= 0) {
        // relaunch upward at target speed after sticking to paddle
        b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, -getTargetSpeed()));
      } else {
        b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, 0));
        return;
      }
    }

    // Flub passive: gentle horizontal attraction toward paddle
    if (getRunState().crewBoons.flub_ballsAttractedToBoat.get()) {
      const paddles = getEntitiesOfKind(ENTITY_KINDS.paddle);
      if (paddles.length > 0) {
        const paddlePos = b2Body_GetPosition(paddles[0].bodyId);
        const ballPos = b2Body_GetPosition(bodyId);
        const dx = paddlePos.x - ballPos.x;
        const impulse = new b2Vec2(dx * 0.15, 0);
        b2Body_ApplyLinearImpulseToCenter(bodyId, impulse, true);
      }
    }

    const velocity = b2Body_GetLinearVelocity(bodyId);
    const speed = Math.max(0.1, Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y));
    const absVy = Math.abs(velocity.y);

    const minAngleRad = (15 * Math.PI) / 180;
    const targetSpeed = getTargetSpeed();

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
    handlers: {
      brick: (_self: NormBallEntity, brickEntity: any) => {
        if (explosiveTimer > 0) {
          const hitPos = b2Body_GetPosition(brickEntity.bodyId);
          getEntitiesOfKind(ENTITY_KINDS.brick).forEach((b) => {
            if (b === brickEntity) return;
            const pos = b2Body_GetPosition(b.bodyId);
            const dx = pos.x - hitPos.x;
            const dy = pos.y - hitPos.y;
            if (dx * dx + dy * dy < 9) b.hit(); // radius 3
          });
        }
      },
      paddle: () => {
        if (getRunState().crewBoons.mysz_ballsStickToBoat.get()) {
          stickyTimer = 250;
        }
      },
    },
    entity: normBall,
  }));

  // Crew active ability events
  useGameEvent(GameEvent.CREW_HASTE_BALLS, () => {
    setHaste(5000);
  });

  useGameEvent(GameEvent.CREW_DOUBLE_BALLS, () => {
    const position = b2Body_GetPosition(bodyId);
    const newBall = NormBall({ x: position.x, y: position.y });
    newBall.startUpdating();
  });

  useGameEvent(GameEvent.CREW_RECALL_BALLS, () => {
    const paddles = getEntitiesOfKind(ENTITY_KINDS.paddle);
    if (paddles.length > 0) {
      const paddlePos = b2Body_GetPosition(paddles[0].bodyId);
      // teleport to just above paddle, launch upward
      b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, -getTargetSpeed()));
      // Note: can't set position directly mid-step; use impulse redirect instead
      const vel = b2Body_GetLinearVelocity(bodyId);
      const ballPos = b2Body_GetPosition(bodyId);
      const dx = paddlePos.x - ballPos.x;
      b2Body_ApplyLinearImpulseToCenter(bodyId, new b2Vec2(dx * 2, -Math.abs(vel.y) * 3), true);
    }
  });

  useGameEvent(GameEvent.CREW_EXPLODE_BALLS, () => {
    explosiveTimer = 5000;
    ballSprite.tint = 0xff4400;
  });

  useGameEvent(GameEvent.CREW_GHOST_BALLS, () => {
    setGhost();
  });

  useGameEvent(GameEvent.CREW_SPAWN_BALL, () => {
    if (_spawnBallLock) return;
    _spawnBallLock = true;
    queueMicrotask(() => {
      _spawnBallLock = false;
    });
    const paddles = getEntitiesOfKind(ENTITY_KINDS.paddle);
    const spawnX = paddles.length > 0 ? b2Body_GetPosition(paddles[0].bodyId).x : x;
    const newBall = NormBall({ x: spawnX, y: y });
    newBall.startUpdating();
    b2Body_SetLinearVelocity(newBall.bodyId, new b2Vec2(0, -BALL_SPEED_DEFAULT));
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
