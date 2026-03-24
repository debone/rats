import type { EntityKind, KnownEntity } from '@/entities/entity-kinds';
import { getEntities } from './scope';

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
