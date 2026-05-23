import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import type { EventEmitter } from '@/core/game/EventEmitter';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { useCollisionHandler, useEmitter, usePhysics, useUpdate, useWorldId } from '@/hooks/hooks';
import { EntityCollisionSystem } from '@/systems/physics/EntityCollisionSystem';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import {
  b2Body_ApplyForceToCenter,
  b2Body_ComputeAABB,
  b2Body_GetLinearVelocity,
  b2Body_GetUserData,
  b2Body_SetLinearVelocity,
  b2Body_SetUserData,
  b2DefaultQueryFilter,
  b2MulSV,
  b2Neg,
  b2Shape_GetAABB,
  b2Shape_GetBody,
  b2ShapeId,
  b2Vec2,
  b2World_OverlapAABB,
  type b2BodyId,
} from 'phaser-box2d';
import type { CheeseEntity } from './Cheese';
import type { NormBallEntity } from './NormBall';
import type { ScrapEntity } from './Scrap';

export type WaterBottomEvents = {
  ballCollided: WaterBottomCollisionContext<NormBallEntity>;
  cheeseCollided: WaterBottomCollisionContext<CheeseEntity>;
  scrapCollided: WaterBottomCollisionContext<ScrapEntity>;
};

export interface WaterBottomCollisionContext<T> {
  waterBottom: WaterBottomEntity;
  object: T;
}

export interface WaterBottomEntity extends EntityBase {
  bodyId: b2BodyId;
  events: EventEmitter<WaterBottomEvents>;
  destroy(): void;
}

export interface WaterBottomProps {
  bodyId: b2BodyId;
  waterParticles: ParticleEmitter;
}

export const WaterBottom = defineEntity(({ bodyId, waterParticles }: WaterBottomProps) => {
  const physics = usePhysics();
  const worldId = useWorldId();
  const events = useEmitter<WaterBottomEvents>();

  const waterBottom = entity<WaterBottomEntity>({
    bodyId,
    events,
  });

  const filter = b2DefaultQueryFilter();
  const waterAABB = b2Body_ComputeAABB(bodyId);

  let everythingFloats = false;
  let ballsBounceWater = false;
  let cheeseFloats = false;

  const applyBuoyancy = (body: b2BodyId, shapeId: b2ShapeId) => {
    const objectAABB = b2Shape_GetAABB(shapeId);
    const depth = objectAABB.lowerBoundY - waterAABB.upperBoundY;
    b2Body_ApplyForceToCenter(body, new b2Vec2(0, -depth * 50), true);
    const velDir = b2Body_GetLinearVelocity(body);
    const dragForce = b2MulSV(3, b2Neg(velDir));
    dragForce.x *= 0.1;
    b2Body_ApplyForceToCenter(body, dragForce, true);
  };

  const { start, stop } = useUpdate(() => {
    b2World_OverlapAABB(
      worldId,
      waterAABB,
      filter,
      (shapeId: b2ShapeId) => {
        const body = b2Shape_GetBody(shapeId);
        const userData = b2Body_GetUserData(body) as {
          type: 'cheese' | 'scrap' | 'ball';
          bouncing: number;
          bounced: boolean;
        };

        if (userData?.type === 'cheese' && (everythingFloats || cheeseFloats)) {
          applyBuoyancy(body, shapeId);
        }

        if (userData?.type === 'scrap' && everythingFloats) {
          applyBuoyancy(body, shapeId);
        }

        if (userData?.type === 'ball' && ballsBounceWater) {
          const velDir = b2Body_GetLinearVelocity(body);
          const objectAABB = b2Shape_GetAABB(shapeId);
          const depth = objectAABB.lowerBoundY - waterAABB.upperBoundY;

          if (depth < -0.5 && velDir.y < 0) {
            // next collision with water will remove the ball
            userData.bounced = true;

            if (Math.abs(velDir.y) < Math.abs(velDir.x) * 2) {
              b2Body_SetLinearVelocity(body, new b2Vec2(velDir.x, -velDir.y));
            } else {
              b2Body_SetLinearVelocity(body, new b2Vec2(-velDir.x, -velDir.y));
            }
          }

          // eeeeelllllleeeeeeennnnkkkkaaaaaaa
          // eeeeelllllllleeeeeeenkaaaaaaa
          if (!isFinite(userData.bouncing)) {
            userData.bouncing = 1;
          } else {
            userData.bouncing++;
          }

          if (userData.bouncing === 100) {
            const entityCollisions = getGameContext().systems.get(EntityCollisionSystem);
            const { x, y } = BodyToScreen(body);
            waterParticles.explode(10, x, y);
            events.emit('ballCollided', { waterBottom, object: entityCollisions.get(body)?.entity });
          }

          b2Body_SetUserData(body, userData);
        }
      },
      null,
    );
  });

  // Emits events for objects in water that are no longer covered by any active boon.
  // Call after updating boon flags so the checks reflect the new state.
  const cleanup = () => {
    const entityCollisions = getGameContext().systems.get(EntityCollisionSystem);

    b2World_OverlapAABB(
      worldId,
      waterAABB,
      filter,
      (shapeId: b2ShapeId) => {
        const body = b2Shape_GetBody(shapeId);
        const userData = b2Body_GetUserData(body) as { type: 'cheese' | 'scrap' | 'ball' };
        const e = entityCollisions.get(body);
        const { x, y } = BodyToScreen(body);

        if (userData?.type === 'cheese' && !everythingFloats && !cheeseFloats) {
          waterParticles.explode(10, x, y);
          if (e?.entity) {
            events.emit('cheeseCollided', { waterBottom, object: e.entity });
          }
        }
        if (userData?.type === 'scrap' && !everythingFloats) {
          waterParticles.explode(10, x, y);
          if (e?.entity) {
            events.emit('scrapCollided', { waterBottom, object: e.entity });
          }
        }
        if (userData?.type === 'ball' && !ballsBounceWater) {
          waterParticles.explode(10, x, y);
          if (e?.entity) {
            events.emit('ballCollided', { waterBottom, object: e.entity });
          }
        }
      },
      null,
    );
  };

  const syncUpdateState = () => {
    cleanup();

    if (everythingFloats || ballsBounceWater || cheeseFloats) {
      start();
    } else {
      stop();
    }
  };

  getRunState().crewBoons.littlemi_everythingFloats.subscribe((value) => {
    everythingFloats = value;
    syncUpdateState();
  });

  getRunState().crewBoons.meedas_ballsBounceWater.subscribe((value) => {
    ballsBounceWater = value;
    syncUpdateState();
  });

  getRunState().crewBoons.mrblu_cheeseFloats.subscribe((value) => {
    cheeseFloats = value;
    syncUpdateState();
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'water-bottom',
    handlers: {
      ball: (_self: WaterBottomEntity, ballBody: NormBallEntity) => {
        const { x, y } = BodyToScreen(ballBody.bodyId);
        const { bounced } = b2Body_GetUserData(ballBody.bodyId) as { bounced: boolean };
        waterParticles.explode(100, x, y);
        sfx.playPitched(ASSETS.sounds_Splash_Large_4_2, { volume: 0.25 });

        if (bounced || (!everythingFloats && !ballsBounceWater)) {
          events.emit('ballCollided', { waterBottom, object: ballBody });
        }
      },
      cheese: (_self: WaterBottomEntity, cheeseBody: CheeseEntity) => {
        const { x, y } = BodyToScreen(cheeseBody.bodyId);
        waterParticles.explode(25, x, y);
        sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });

        if (!everythingFloats && !cheeseFloats) {
          events.emit('cheeseCollided', { waterBottom, object: cheeseBody });
        }
      },
      scrap: (_self: WaterBottomEntity, scrapBody: ScrapEntity) => {
        const { x, y } = BodyToScreen(scrapBody.bodyId);
        waterParticles.explode(10, x, y);
        sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });

        if (!everythingFloats) {
          events.emit('scrapCollided', { waterBottom, object: scrapBody });
        }
      },
    },
    entity: waterBottom,
  }));

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  return waterBottom;
});
