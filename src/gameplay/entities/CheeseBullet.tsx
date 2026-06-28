import { ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { CHEESE_DEFS } from '@/entities/cheese/Cheese';
import type { BrickEntity } from '@/gameplay/entities/bricks/Brick';
import type { StrongBrickEntity } from '@/gameplay/entities/bricks/StrongBrick';
import { useBodySprite, useCollisionHandler, usePhysics, useWorldId } from '@/hooks/hooks';
import { CHEESE_BULLET_MASK, PhysicsLayer, setBodyFilter } from '@/systems/physics/PhysicsLayers';
import { b2Body_SetLinearVelocity, b2Body_SetUserData, b2BodyId, b2BodyType, b2Vec2, CreateCircle } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CheeseBulletEntity extends EntityBase {
  bodyId: b2BodyId;
}

export interface CheeseBulletProps {
  pos: b2Vec2;
}

export const CheeseBullet = defineEntity(({ pos }: CheeseBulletProps) => {
  const worldId = useWorldId();
  const physics = usePhysics();

  const { bodyId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(pos.x, pos.y),
    radius: 0.3,
    density: 1,
    friction: 0.5,
    restitution: 0,
  });

  setBodyFilter(bodyId, PhysicsLayer.CHEESE_BULLET, CHEESE_BULLET_MASK);

  b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, 20));

  b2Body_SetUserData(bodyId, { type: 'cheese-bullet' });

  const texture = typedAssets.get(ASSETS.prototype).textures[CHEESE_DEFS['gruyere'].texture];

  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);
  useBodySprite(sprite, bodyId);

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'cheese-bullet',
    handlers: {
      paddle: () => {
        cheeseBullet.destroy();
      },
      'bottom-wall': () => {
        cheeseBullet.destroy();
      },
      'strong-brick': (_self: CheeseBulletEntity, _brick: StrongBrickEntity) => {
        _brick.hit(1);
        cheeseBullet.destroy();
      },
      brick: (_self: CheeseBulletEntity, _brick: BrickEntity) => {
        _brick.hit();
        cheeseBullet.destroy();
      },
    },
    entity: cheeseBullet,
  }));

  const cheeseBullet = entity<CheeseBulletEntity>({
    bodyId,
  });

  return cheeseBullet;
});
