import { type PrototypeTextures, ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, onCleanup } from '@/core/entity/scope';
import type { EntityBase } from '@/entities/entity-kinds';
import { useBodySprite, useCollisionHandler, usePhysics } from '@/hooks/hooks';
import type { b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CatTailProps {
  bodyId: b2BodyId;
  texture: string;
}

export interface CatTailEntity extends EntityBase {
  bodyId: b2BodyId;
}

export const CatTail = defineEntity(({ bodyId, texture }: CatTailProps) => {
  const physics = usePhysics();

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
  const sprite = new Sprite((bg as Record<string, any>)[texture]);
  sprite.anchor.set(0.5, 0.5);
  sprite.zIndex = 1000;
  useBodySprite(sprite, bodyId);

  const catPiece = {
    bodyId,
  };

  physics.enableGravity(bodyId);

  onCleanup(() => {
    physics.disableGravity(bodyId);
    physics.queueDestruction(bodyId);
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'cat-piece',
    handlers: {},
    entity: catPiece,
  }));

  return catPiece;
});
