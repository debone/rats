import { type PrototypeTextures, ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, onCleanup } from '@/core/entity/scope';
import type { EntityBase } from '@/entities/entity-kinds';
import { useBodySprite, useCollisionHandler, usePhysics } from '@/hooks/hooks';
import type { b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CatPieceProps {
  bodyId: b2BodyId;
  texture: string;
}

export interface CatPieceEntity extends EntityBase {
  bodyId: b2BodyId;
}

export const CatPiece = defineEntity(({ bodyId, texture }: CatPieceProps) => {
  const physics = usePhysics();

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
  const sprite = new Sprite((bg as Record<string, any>)[texture]);
  useBodySprite(sprite, bodyId, { offsetX: -14, offsetY: -43 });

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
