/**
 * Central registry of entity discriminator strings. Use these constants (not raw
 * strings) so renames stay type-checked and collisions are obvious at the call site.
 *
 * Values are namespaced with `entity:` to avoid clashes with other string unions.
 */
export const ENTITY_KINDS = {
  normBall: 'entity:norm-ball',
  brick: 'entity:brick',
  wall: 'entity:wall',
  paddle: 'entity:paddle',
  cheese: 'entity:cheese',
  door: 'entity:door',
  scrap: 'entity:scrap',
} as const;

export type EntityKind = (typeof ENTITY_KINDS)[keyof typeof ENTITY_KINDS];

export interface EntityBase<K extends EntityKind = EntityKind> {
  readonly kind: K;
}
