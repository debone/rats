export interface EntityBase {
  readonly kind: symbol;
  destroy(): void;
}

/**
 * The members you need to supply when building an entity of type `T` inside
 * `defineEntity`. Strips the `EntityBase` members (`kind`, `destroy`) from the
 * required shape — `defineEntity` injects those automatically — while
 * `ThisType<T>` makes `this` inside every method resolve to the full entity
 * type, so you can call `this.destroy()`, `this.bodyId`, etc. without
 * redeclaring them.
 *
 * @example
 * const brick = { bodyId, hit() { this.destroy(); } } satisfies EntityBody<BrickEntity>;
 */
export type EntityBody<T extends EntityBase> = Omit<T, keyof EntityBase> & ThisType<T>;

/**
 * Declare an entity's body inside `defineEntity` without re-specifying `kind`
 * or `destroy` — those are injected by `defineEntity` at construction time.
 *
 * Unlike `satisfies EntityBody<T>`, this returns the variable typed as the
 * full `T`, so you can pass it to callbacks or call `entity.destroy()` from
 * closures without any casting.
 *
 * `ThisType<T>` is still in effect for all methods, so `this.destroy()`,
 * `this.bodyId`, etc. resolve correctly inside those methods.
 *
 * @example
 * const cheese = entityBody<CheeseEntity>({ type, bodyId });
 * cheese.destroy(); // ✓ — typed as CheeseEntity even without declaring destroy
 */
export function entity<T extends EntityBase>(body: EntityBody<T>): T {
  return body as unknown as T;
}

type Effect = () => (() => void) | void;

interface Scope {
  effects: Effect[];
  cleanups: Array<() => void>;
  unmount: () => void;
}

/** Root scope for each entity created by `defineEntity` — used by `attach`. */
const entityScopes = new WeakMap<object, Scope>();
const entities = new Set<EntityBase>();
const entityRegistry = new Map<symbol, Set<EntityBase>>();

let activeScope: Scope | null = null;
let activeChildren: Set<EntityBase> | null = null;

export function withActiveChildren<T>(set: Set<EntityBase> | null, fn: () => T): T {
  const prev = activeChildren;
  activeChildren = set;
  const result = fn();
  activeChildren = prev;
  return result;
}

/** All live entities from `defineEntity` factories (discriminated by `kind`). */
export function getEntities(): readonly EntityBase[] {
  return Array.from(entities);
}

export function getEntitiesForKind(kind: symbol): readonly EntityBase[] {
  return Array.from(entityRegistry.get(kind) || []);
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

export type EntityFactory<Props extends object, API extends object> = ((props: Props) => EntityBase & API) & {
  readonly kind: symbol;
};

export function defineEntity<Props extends object, API extends object>(
  factory: (props: Props) => API & ThisType<EntityBase & API>,
): EntityFactory<Props, API> {
  const kind = Symbol(factory.name);

  const wrappedFactory = (props: Props): EntityBase & API => {
    const scope = createScope();
    const prev = activeScope;
    activeScope = scope;

    const api = factory(props) as object;

    const entity = Object.assign(api, {
      kind,
      destroy: () => {
        scope.unmount();
      },
    }) as EntityBase & API;

    scope.cleanups.push(() => {
      entities.delete(entity);
      entityRegistry.get(kind)?.delete(entity);
    });

    if (activeChildren !== null) {
      const parentSet = activeChildren;
      parentSet.add(entity);
      scope.cleanups.push(() => {
        parentSet.delete(entity);
      });
    }

    activeScope = prev;
    applyEffects(scope);
    entityScopes.set(entity, scope);
    entities.add(entity);

    let kindSet = entityRegistry.get(kind);
    if (!kindSet) {
      kindSet = new Set();
      entityRegistry.set(kind, kindSet);
    }
    kindSet.add(entity);

    return entity;
  };

  Object.defineProperty(wrappedFactory, 'kind', { value: kind, writable: false, enumerable: true });

  return wrappedFactory as EntityFactory<Props, API>;
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
