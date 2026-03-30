import { ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { changeScraps } from '@/data/game-state';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useBodySprite, useCollisionHandler, usePhysics, useWorldId } from '@/hooks/hooks';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_SetUserData,
  b2BodyType,
  b2Normalize,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
  b2Vec2,
  CreateCircle,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface ScrapEntity extends EntityBase<typeof ENTITY_KINDS.scrap> {
  bodyId: b2BodyId;
  destroy(): void;
}

export interface ScrapProps {
  pos: { x: number; y: number };

  onCollected?: (scrap: ScrapEntity) => void;
}

export const Scrap = defineEntity(({ pos, onCollected }: ScrapProps): ScrapEntity => {
  const worldId = useWorldId();
  const physics = usePhysics();
  const unmount = getUnmount();

  const { bodyId, shapeId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(pos.x, pos.y),
    radius: 0.3,
    density: 1,
    friction: 0.5,
    restitution: 0,
  });

  const scrapFilter = b2Shape_GetFilter(shapeId);
  scrapFilter.maskBits = 0x0005;
  scrapFilter.categoryBits = 0xfffd;
  b2Shape_SetFilter(shapeId, scrapFilter);

  const f = new b2Vec2(Math.random() * 1 - 0.5, Math.random() * 1 - 0.5);
  b2Normalize(f);
  b2Body_ApplyLinearImpulseToCenter(bodyId, f, true);
  physics.enableGravity(bodyId);
  onCleanup(() => {
    physics.disableGravity(bodyId);
    physics.queueDestruction(bodyId);
  });

  b2Body_SetUserData(bodyId, { type: 'scrap' });

  useCollisionHandler(bodyId, () => ({
    tag: 'scrap',
    handlers: {
      paddle: () => {
        onCollected?.(scrap);
        changeScraps(Math.floor(Math.random() * 1) + 3);
        scrap.destroy();
      },
    },
    entity: scrap,
  }));

  const texture = typedAssets.get(ASSETS.prototype).textures['scraps#0'];
  const sprite = new Sprite({ texture, scale: Math.random() * 0.3 + 0.8 });
  sprite.anchor.set(0.5, 0.5);
  useBodySprite(sprite, bodyId);

  const scrap: ScrapEntity = {
    kind: ENTITY_KINDS.scrap,
    bodyId,

    destroy() {
      unmount();
    },
  };

  return scrap;
});
