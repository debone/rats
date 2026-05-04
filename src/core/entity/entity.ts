import type { EntityBase, EntityFactory } from './scope';
import { getEntitiesForKind } from './scope';

export function getEntitiesOf<P extends object, A extends object>(
  factory: EntityFactory<P, A>,
): Array<EntityBase & A> {
  return getEntitiesForKind(factory.kind) as Array<EntityBase & A>;
}
