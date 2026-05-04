export interface EntityBase {
  readonly kind: symbol;
  destroy(): void;
}

type Effect = () => (() => void) | void;

interface Scope {
  effects: Effect[];
  cleanups: Array<() => void>;
  unmount: () => void;
}

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

export function getEntities(): readonly EntityBase[] {
  return Array.from(entities);
}

export function getEntitiesForKind(kind: symbol): readonly EntityBase[] {
  return Array.from(entityRegistry.get(kind) ?? []);
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

/** Returns the current entity's destroy function, for entities that need to self-destruct from callbacks. */
export function getUnmount(): () => void {
  if (!activeScope) throw new Error('getUnmount called outside defineEntity scope');
  return activeScope.unmount;
}

export type EntityFactory<Props extends object, API extends object> =
  ((props: Props) => EntityBase & API) & { readonly kind: symbol };

export function defineEntity<Props extends object, API extends object>(
  factory: (props: Props) => API,
): EntityFactory<Props, API> {
  const kind = Symbol(factory.name);

  const wrappedFactory = (props: Props): EntityBase & API => {
    const scope = createScope();
    const prev = activeScope;
    activeScope = scope;

    const api = factory(props) as object;

    const entity = Object.assign(api, {
      kind,
      destroy() { scope.unmount(); },
    }) as EntityBase & API;

    scope.cleanups.push(() => {
      entities.delete(entity);
      entityRegistry.get(kind)?.delete(entity);
    });

    if (activeChildren !== null) {
      const parentSet = activeChildren;
      parentSet.add(entity);
      scope.cleanups.push(() => parentSet.delete(entity));
    }

    activeScope = prev;
    applyEffects(scope);
    entityScopes.set(entity, scope);
    entities.add(entity);

    let kindSet = entityRegistry.get(kind);
    if (!kindSet) { kindSet = new Set(); entityRegistry.set(kind, kindSet); }
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

  function detachFromParent() {
    if (detached) return;
    detached = true;
    childUnmount();
  }

  parentScope.cleanups.unshift(detachFromParent);

  if (result === undefined || result === null) {
    return { detach } as AttachHandle<R>;
  }

  if (typeof result === 'object' && !Array.isArray(result)) {
    return Object.assign({}, result as object, { detach }) as AttachHandle<R>;
  }

  return { detach, value: result } as AttachHandle<R>;
}

export function hasEntityScope(entity: object): boolean {
  return entityScopes.has(entity);
}
