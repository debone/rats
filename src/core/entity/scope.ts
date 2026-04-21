import type { EntityBase } from '@/entities/entity-kinds';

type Effect = () => (() => void) | void;

interface Scope {
  effects: Effect[];
  cleanups: Array<() => void>;
  unmount: () => void;
}

/** Root scope for each entity created by `defineEntity` — used by `attach`. */
const entityScopes = new WeakMap<object, Scope>();
const entities = new Set<EntityBase>();

let activeScope: Scope | null = null;

/** Set by LevelSystem before level.load() so spawned entities register as level children. */
let activeLevelChildren: Set<EntityBase> | null = null;

export function setActiveLevelChildren(set: Set<EntityBase> | null): void {
  activeLevelChildren = set;
}

/** All live entities from `defineEntity` factories (discriminated by `kind`). */
export function getEntities(): readonly EntityBase[] {
  return Array.from(entities);
}

function createScope(): Scope {
  const scope: Scope = {
    effects: [],
    cleanups: [],
    unmount() {
      scope.cleanups.forEach((c) => c());
      scope.cleanups.length = 0;
    },
  };
  return scope;
}

function applyEffects(scope: Scope) {
  for (const effect of scope.effects) {
    const cleanup = effect();
    if (cleanup) scope.cleanups.push(cleanup);
  }
  scope.effects.length = 0;
}

export function mountEffect(effect: Effect) {
  if (!activeScope) throw new Error('mountEffect called outside defineEntity scope');
  activeScope.effects.push(effect);
}

export function onCleanup(fn: () => void) {
  if (!activeScope) throw new Error('onCleanup called outside defineEntity scope');
  activeScope.cleanups.push(fn);
}

export function getUnmount(): () => void {
  if (!activeScope) throw new Error('getUnmount called outside defineEntity scope');
  return activeScope.unmount;
}

export function defineEntity<Props, Entity extends EntityBase>(
  factory: (props: Props) => Entity,
): (props: Props) => Entity {
  return (props: Props) => {
    const scope = createScope();
    const prev = activeScope;
    activeScope = scope;

    const entity = factory(props);

    onCleanup(() => {
      entities.delete(entity);
    });

    if (activeLevelChildren !== null) {
      const parentSet = activeLevelChildren;
      parentSet.add(entity);
      onCleanup(() => parentSet.delete(entity));
    }

    activeScope = prev;
    applyEffects(scope);
    entityScopes.set(entity, scope);
    entities.add(entity);

    return entity;
  };
}

export type AttachHandle<R> = R extends void | undefined
  ? { detach: () => void }
  : R extends Record<string, unknown>
    ? R & { detach: () => void }
    : { detach: () => void; value: R };

/**
 * Run a behavior in a child scope bound to an entity from `defineEntity`.
 * Child effects/cleanups run with the same `mountEffect` / `onCleanup` rules.
 *
 * - Calling `detach()` tears down only this attachment.
 * - Destroying the entity runs all attachments first (prepended so teardown happens before body/sprite cleanup).
 */
export function attach<Entity extends EntityBase, R>(entity: Entity, behavior: (entity: Entity) => R): AttachHandle<R> {
  const parentScope = entityScopes.get(entity);
  if (!parentScope) {
    throw new Error('attach: entity was not created with defineEntity (no scope registered)');
  }

  const childScope = createScope();
  const prev = activeScope;
  activeScope = childScope;

  const result = behavior(entity);

  activeScope = prev;
  applyEffects(childScope);

  const childUnmount = childScope.unmount.bind(childScope);
  let detached = false;

  const detach = () => {
    if (detached) return;
    detached = true;
    childUnmount();
    const idx = parentScope.cleanups.indexOf(detachFromParent);
    if (idx !== -1) parentScope.cleanups.splice(idx, 1);
  };

  /** Wrapper so we can remove it from parent's cleanups list by reference. */
  function detachFromParent() {
    if (detached) return;
    detached = true;
    childUnmount();
  }

  // Run attachment teardown before later entity cleanups (body destroy, etc.)
  parentScope.cleanups.unshift(detachFromParent);

  if (result === undefined || result === null) {
    return { detach } as AttachHandle<R>;
  }

  if (typeof result === 'object' && !Array.isArray(result)) {
    return Object.assign({}, result as object, { detach }) as AttachHandle<R>;
  }

  return { detach, value: result } as AttachHandle<R>;
}

/** True if `entity` was created with `defineEntity` (can use `attach`). */
export function hasEntityScope(entity: object): boolean {
  return entityScopes.has(entity);
}
