import { type PrototypeTextures, ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { type EntityBase, ENTITY_KINDS } from '@/entities/entity-kinds';
import { useBodySprite, useCollisionHandler, usePhysics } from '@/hooks/hooks';
import type { b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CatPieceProps {
  bodyId: b2BodyId;
  texture: string;
}

export interface CatPieceEntity extends EntityBase<typeof ENTITY_KINDS.catPiece> {
  bodyId: b2BodyId;
  destroy(): void;
}

export const CatPiece = defineEntity(({ bodyId, texture }: CatPieceProps): CatPieceEntity => {
  const physics = usePhysics();
  const unmount = getUnmount();

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
  const sprite = new Sprite((bg as Record<string, any>)[texture]);
  useBodySprite(sprite, bodyId, { offsetX: -14, offsetY: -43 });

  const catPiece: CatPieceEntity = {
    kind: ENTITY_KINDS.catPiece,
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
