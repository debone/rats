import type { EntityKind } from '@/core/entity/entity-kinds';
import { getEntities } from '@/core/entity/scope';
import type { BrickEntity } from '@/systems/level/levels/level-0/Brick';
import type { CheeseEntity } from '@/systems/level/levels/level-0/Cheese';
import type { DoorEntity } from '@/systems/level/levels/level-0/Door';
import type { NormBallEntity } from '@/systems/level/levels/level-0/NormBall';
import type { PaddleEntity } from '@/systems/level/levels/level-0/Paddle';
import type { ScrapEntity } from '@/systems/level/levels/level-0/Scrap';
import type { WallEntity } from '@/systems/level/levels/level-0/Wall';

/** Union of every entity created via `defineEntity` in the game (extend when adding factories). */
export type KnownEntity =
  | NormBallEntity
  | BrickEntity
  | WallEntity
  | PaddleEntity
  | CheeseEntity
  | DoorEntity
  | ScrapEntity;

/** Same entities as `getEntities()`, narrowed to the known union (all current factories participate). */
export function getKnownEntities(): readonly KnownEntity[] {
  return getEntities() as readonly KnownEntity[];
}

export function getEntitiesOfKind<K extends EntityKind>(kind: K): Extract<KnownEntity, { readonly kind: K }>[] {
  return getKnownEntities().filter((e): e is Extract<KnownEntity, { readonly kind: K }> => e.kind === kind);
}

export function isEntityOfKind<K extends EntityKind>(
  entity: KnownEntity,
  kind: K,
): entity is Extract<KnownEntity, { readonly kind: K }> {
  return entity.kind === kind;
}
