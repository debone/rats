import type { ParticleEmitterEntity } from '@/core/particles/ParticleEmitterEntity';
import type { BrickEntity } from '@/systems/level/levels/entities/Brick';
import type { CatTailEntity } from '@/systems/level/levels/entities/CatTail';
import type { CatPieceEntity } from '@/systems/level/levels/entities/CatBody';
import type { CheeseEntity } from '@/systems/level/levels/entities/Cheese';
import type { DoorEntity } from '@/systems/level/levels/entities/Door';
import type { KeyListenerEntity } from '@/systems/level/levels/entities/KeyListener';
import type { NormBallEntity } from '@/systems/level/levels/entities/NormBall';
import type { PaddleEntity } from '@/systems/level/levels/entities/Paddle';
import type { ScrapEntity } from '@/systems/level/levels/entities/Scrap';
import type { StrongBrickEntity } from '@/systems/level/levels/entities/StrongBrick';
import type { WallEntity } from '@/systems/level/levels/entities/Wall';

/**
 * Central registry of entity discriminator strings. Use these constants (not raw
 * strings) so renames stay type-checked and collisions are obvious at the call site.
 *
 * Values are namespaced with `entity:` to avoid clashes with other string unions.
 */
export const ENTITY_KINDS = {
  normBall: 'entity:norm-ball',
  brick: 'entity:brick',
  strongBrick: 'entity:strong-brick',
  wall: 'entity:wall',
  waterBottom: 'entity:water-bottom',
  paddle: 'entity:paddle',
  cheese: 'entity:cheese',
  door: 'entity:door',
  scrap: 'entity:scrap',

  catPiece: 'entity:cat-piece',
  catTail: 'entity:cat-tail',

  particleEmitter: 'entity:particle-emitter',
  keyListener: 'entity:key-listener',
} as const;

export type EntityKind = (typeof ENTITY_KINDS)[keyof typeof ENTITY_KINDS];

export interface EntityBase<K extends EntityKind = EntityKind> {
  readonly kind: K;
  destroy(): void;
}

/** Maps each runtime kind to its concrete entity type (extend when adding factories). */
export interface EntityByKind {
  [ENTITY_KINDS.normBall]: NormBallEntity;
  [ENTITY_KINDS.brick]: BrickEntity;
  [ENTITY_KINDS.strongBrick]: StrongBrickEntity;
  [ENTITY_KINDS.wall]: WallEntity;
  [ENTITY_KINDS.paddle]: PaddleEntity;
  [ENTITY_KINDS.cheese]: CheeseEntity;
  [ENTITY_KINDS.door]: DoorEntity;
  [ENTITY_KINDS.scrap]: ScrapEntity;
  [ENTITY_KINDS.keyListener]: KeyListenerEntity;
  [ENTITY_KINDS.particleEmitter]: ParticleEmitterEntity;
  [ENTITY_KINDS.catPiece]: CatPieceEntity;
  [ENTITY_KINDS.catTail]: CatTailEntity;
}

export type KnownEntity = EntityByKind[EntityKind];
