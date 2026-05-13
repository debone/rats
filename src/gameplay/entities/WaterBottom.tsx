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
        if (userData?.type === 'ball') {
          const velDir = b2Body_GetLinearVelocity(body);
          const objectAABB = b2Shape_GetAABB(shapeId);
          const depth = objectAABB.lowerBoundY - waterAABB.upperBoundY;
          console.log('ball hit water bottom', depth, velDir.y);
          if (depth < -0.5 && velDir.y < 0) {
            if (Math.abs(velDir.y) < Math.abs(velDir.x)) {
              b2Body_SetLinearVelocity(body, new b2Vec2(velDir.x, -velDir.y));
            } else {
              b2Body_SetLinearVelocity(body, new b2Vec2(-velDir.x, -velDir.y));
            }
          }
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

  let everythingFloats = false;
  getRunState().crewBoons.littlemi_everythingFloats.subscribe((value) => {
    console.log('everythingFloats', value);
    everythingFloats = value;
    if (!everythingFloats) {
      cleanupObjects();
      stop();
      console.log('stopping water bottom update');
    } else {
      console.log('starting water bottom update');
      start();
    }
    // TODO if switched to false, make a AABB check to see if anything doesn't need drowning
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'water-bottom',
    handlers: {
      ball: (_self: WaterBottomEntity, ballBody: NormBallEntity) => {
        const { x, y } = BodyToScreen(ballBody.bodyId);
        waterParticles.explode(100, x, y);
        sfx.playPitched(ASSETS.sounds_Splash_Large_4_2, { volume: 0.25 });

        if (!everythingFloats) {
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
