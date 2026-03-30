import { type PrototypeTextures, ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { type EntityBase, ENTITY_KINDS } from '@/entities/entity-kinds';
import { useBodySprite, useCollisionHandler, usePhysics } from '@/hooks/hooks';
import type { b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CatTailProps {
  bodyId: b2BodyId;
  texture: string;
}

export interface CatTailEntity extends EntityBase<typeof ENTITY_KINDS.catTail> {
  bodyId: b2BodyId;
  destroy(): void;
}

export const CatTail = defineEntity(({ bodyId, texture }: CatTailProps): CatTailEntity => {
  const physics = usePhysics();
  const unmount = getUnmount();

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
  const sprite = new Sprite((bg as Record<string, any>)[texture]);
  sprite.anchor.set(0.5, 0.5);
  sprite.zIndex = 1000;
  useBodySprite(sprite, bodyId);

  const catPiece: CatTailEntity = {
    kind: ENTITY_KINDS.catTail,
    bodyId,
    destroy() {
      unmount();
    },
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
