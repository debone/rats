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

  const { start, stop } = useUpdate(() => {
    b2World_OverlapAABB(
      worldId,
      waterAABB,
      filter,
      (shapeId: b2ShapeId) => {
        const body = b2Shape_GetBody(shapeId);
        const userData = b2Body_GetUserData(body) as { type: 'cheese' | 'scrap' | 'ball' };
        if (userData?.type === 'cheese' || userData?.type === 'scrap') {
          const objectAABB = b2Shape_GetAABB(shapeId);
          const depth = objectAABB.lowerBoundY - waterAABB.upperBoundY;
          b2Body_ApplyForceToCenter(body, new b2Vec2(0, -depth * 50), true);

          const velDir = b2Body_GetLinearVelocity(body);

          const dragMag = 3;
          //apply simple linear drag
          const dragForce = b2MulSV(dragMag, b2Neg(velDir));
          dragForce.x *= 0.1;
          b2Body_ApplyForceToCenter(body, dragForce, true);
        }
      },
      null,
    );
  });

  const cleanupObjects = () => {
    const entityCollisions = getGameContext().systems.get(EntityCollisionSystem);

    b2World_OverlapAABB(
      worldId,
      waterAABB,
      filter,
      (shapeId: b2ShapeId) => {
        const body = b2Shape_GetBody(shapeId);
        const userData = b2Body_GetUserData(body) as { type: 'cheese' | 'scrap' | 'ball' };

        if (userData?.type === 'cheese') {
          const entity = entityCollisions.get(body);
          const { x, y } = BodyToScreen(body);
          waterParticles.explode(10, x, y);

          events.emit('cheeseCollided', { waterBottom, object: entity?.entity });
        }
        if (userData?.type === 'scrap') {
          const entity = entityCollisions.get(body);
          const { x, y } = BodyToScreen(body);
          waterParticles.explode(10, x, y);

          events.emit('scrapCollided', { waterBottom, object: entity?.entity });
        }
        if (userData?.type === 'ball') {
          const entity = entityCollisions.get(body);
          const { x, y } = BodyToScreen(body);
          waterParticles.explode(10, x, y);

          events.emit('ballCollided', { waterBottom, object: entity?.entity });
        }
      },
      null,
    );
  };

  const { start: startBallsBounceWater, stop: stopBallsBounceWater } = useUpdate(() => {
    b2World_OverlapAABB(
      worldId,
      waterAABB,
      filter,
      (shapeId: b2ShapeId) => {
        const body = b2Shape_GetBody(shapeId);
        const userData = b2Body_GetUserData(body) as { type: 'ball'; bouncing: number; bounced: boolean };

        if (userData?.type === 'ball') {
          console.log('userData', userData);
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
            // 50 frames of bouncing
            cleanupBalls();
          }

          b2Body_SetUserData(body, userData);
        }
      },
      null,
    );
  });

  const cleanupBalls = () => {
    const entityCollisions = getGameContext().systems.get(EntityCollisionSystem);

    b2World_OverlapAABB(
      worldId,
      waterAABB,
      filter,
      (shapeId: b2ShapeId) => {
        const body = b2Shape_GetBody(shapeId);
        const userData = b2Body_GetUserData(body) as { type: 'ball'; bounced: boolean };

        if (userData?.type === 'ball') {
          const entity = entityCollisions.get(body);
          const { x, y } = BodyToScreen(body);
          waterParticles.explode(10, x, y);

          events.emit('ballCollided', { waterBottom, object: entity?.entity });
        }
      },
      null,
    );
  };

  let everythingFloats = false;
  getRunState().crewBoons.littlemi_everythingFloats.subscribe((value) => {
    everythingFloats = value;
    if (everythingFloats) {
      start();
    } else {
      cleanupObjects();
      stop();
    }
  });

  let ballsBounceWater = false;
  getRunState().crewBoons.meedas_ballsBounceWater.subscribe((value) => {
    ballsBounceWater = value;
    if (ballsBounceWater) {
      startBallsBounceWater();
    } else {
      cleanupBalls();
      stopBallsBounceWater();
    }
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'water-bottom',
    handlers: {
      ball: (_self: WaterBottomEntity, ballBody: NormBallEntity) => {
        const { x, y } = BodyToScreen(ballBody.bodyId);
        const { bounced } = b2Body_GetUserData(ballBody.bodyId) as { bounced: boolean };
        waterParticles.explode(100, x, y);
        sfx.playPitched(ASSETS.sounds_Splash_Large_4_2, { volume: 0.25 });

        console.log('bounced', bounced, everythingFloats, ballsBounceWater);
        if (bounced || (!everythingFloats && !ballsBounceWater)) {
          events.emit('ballCollided', { waterBottom, object: ballBody });
        }
      },
      cheese: (_self: WaterBottomEntity, cheeseBody: CheeseEntity) => {
        const { x, y } = BodyToScreen(cheeseBody.bodyId);
        waterParticles.explode(25, x, y);
        sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });

        if (!everythingFloats) {
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
