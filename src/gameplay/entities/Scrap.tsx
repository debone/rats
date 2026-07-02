import { ASSETS } from '@/assets';
import { createAnimatedSprite } from '@/core/animation/animatedSprite';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { changeScraps } from '@/data/game-state';
import { useBodySprite, useCollisionHandler, useGameEvent, usePhysics, useWorldId } from '@/hooks/hooks';
import { PhysicsLayer, PICKUP_MASK, setBodyFilter } from '@/systems/physics/PhysicsLayers';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetLinearVelocity,
  b2Body_GetPosition,
  b2Body_SetUserData,
  b2BodyType,
  b2Normalize,
  b2Vec2,
  CreateCircle,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';
import { YellowCheese } from './Cheese';

export interface ScrapEntity extends EntityBase {
  bodyId: b2BodyId;
}

export interface ScrapProps {
  pos: { x: number; y: number };

  onCollected?: (scrap: ScrapEntity) => void;
}

export const Scrap = defineEntity(({ pos, onCollected }: ScrapProps): ScrapEntity => {
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

  setBodyFilter(bodyId, PhysicsLayer.SCRAP, PICKUP_MASK);

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

  // Reference adoption of the sprite-animation helper: play the `scraps` layer's
  // animation when its Aseprite source has multiple frames (or tags), otherwise
  // fall back to the static first frame. Drops in as an `AnimatedSprite` (a
  // `Sprite` subclass), so body-syncing is unchanged.
  const scale = Math.random() * 0.3 + 0.8;
  const sprite =
    createAnimatedSprite(ASSETS.prototype, 'scraps') ??
    new Sprite({ texture: typedAssets.get(ASSETS.prototype).textures['scraps#0'] });
  sprite.scale.set(scale);
  sprite.anchor.set(0.5, 0.5);
  useBodySprite(sprite, bodyId);

  const scrap = entity<ScrapEntity>({
    bodyId,
  });

  useGameEvent(GameEvent.CREW_RUBBLE_BECOMES_CHEESE, () => {
    const scrapPosition = b2Body_GetPosition(scrap.bodyId);
    const scrapVelocity = b2Body_GetLinearVelocity(scrap.bodyId);
    YellowCheese({ pos: scrapPosition.clone(), vel: scrapVelocity.clone() });
    scrap.destroy();
  });

  return scrap;
});
