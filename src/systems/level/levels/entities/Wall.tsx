import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useCollisionHandler, usePhysics } from '@/hooks/hooks';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import type { b2BodyId } from 'phaser-box2d';
import type { CheeseEntity } from './Cheese';
import type { NormBallEntity } from './NormBall';
import type { ScrapEntity } from './Scrap';

export type WallTag = 'left-wall' | 'right-wall' | 'top-wall' | 'bottom-wall' | 'exit';

export interface WallEntity extends EntityBase<typeof ENTITY_KINDS.wall> {
  bodyId: b2BodyId;
  wallCollisionTag: string;
  destroy(): void;
}

export interface WallProps {
  bodyId: b2BodyId;
  wallCollisionTag: string;
  onBall?: (ctx: WallBallContext) => void | Promise<void>;
  onCheese?: (ctx: WallCheeseContext) => void | Promise<void>;
  onScrap?: (ctx: WallScrapContext) => void | Promise<void>;
}

export const Wall = defineEntity(({ bodyId, wallCollisionTag, onBall, onCheese, onScrap }: WallProps): WallEntity => {
  const physics = usePhysics();
  const unmount = getUnmount();

  const wall: WallEntity = {
    kind: ENTITY_KINDS.wall,
    bodyId,
    wallCollisionTag,
    destroy() {
      unmount();
    },
  };

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  useCollisionHandler(bodyId, () => ({
    tag: wallCollisionTag,
    handlers: {
      ball: (_self: WallEntity, ballBody: NormBallEntity) => {
        onBall?.({ wall, ballBody });
      },
      cheese: (_self: WallEntity, cheeseBody: CheeseEntity) => {
        onCheese?.({ wall, cheeseBody });
      },
      scrap: (_self: WallEntity, scrapBody: ScrapEntity) => {
        onScrap?.({ wall, scrapBody: scrapBody });
      },
    },
    entity: wall,
  }));

  return wall;
});

export interface WallBallContext {
  wall: WallEntity;
  ballBody: NormBallEntity;
}

export interface WallCheeseContext {
  wall: WallEntity;
  cheeseBody: CheeseEntity;
}

export interface WallScrapContext {
  wall: WallEntity;
  scrapBody: ScrapEntity;
}

/** Spark burst at the ball position — same behaviour as `StartingLevels` left/right wall FX. */
export function wallSparkOnBall(
  kind: 'left-wall' | 'right-wall' | 'top-wall',
  wallEmitter: ParticleEmitter,
): (ctx: WallBallContext) => void {
  const angle =
    kind === 'left-wall'
      ? { min: 30, max: -30 }
      : kind === 'right-wall'
        ? { min: 150, max: 210 }
        : { min: 60, max: 120 };
  return ({ ballBody }) => {
    wallEmitter.angle = angle;
    const { x, y } = BodyToScreen(ballBody.bodyId);
    wallEmitter.explode(20, x, y);
  };
}
