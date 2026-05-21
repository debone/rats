import { onCleanup, onMount, registerChildren, withActiveChildren, type EntityBase } from '@/core/entity/scope';
import { EventEmitter } from '@/core/game/EventEmitter';
import { effect } from '@/core/reactivity/signals/signals';
import type { Effect } from '@/core/reactivity/signals/types';
import type { GameEventName, GameEventPayload } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import { EntityCollisionSystem, type EntityCollisionConfig } from '@/systems/physics/EntityCollisionSystem';
import { PhysicsSystem } from '@/systems/physics/system';
import { AddSpriteToWorld, RemoveSpriteFromWorld } from '@/systems/physics/WorldSprites';
import type { b2BodyId } from 'phaser-box2d';
import type { Sprite } from 'pixi.js';

export function useWorldId() {
  return getGameContext().worldId!;
}

export function usePhysics() {
  return getGameContext().systems.get(PhysicsSystem);
}

export function useCollision() {
  return getGameContext().systems.get(EntityCollisionSystem);
}

export function useCamera() {
  return getGameContext().camera;
}

export function useBodySprite(
  sprite: Sprite,
  bodyId: b2BodyId,
  options?: { offsetX?: number; offsetY?: number; z?: number; localRotation?: number },
) {
  const ctx = getGameContext();
  onMount(() => {
    AddSpriteToWorld(ctx.worldId!, sprite, bodyId, {
      offsetX: options?.offsetX ?? 0,
      offsetY: options?.offsetY ?? 0,
      localRotation: options?.localRotation,
    });
    if (options?.z) {
      ctx.container!.addChildAt(sprite, options.z);
    } else {
      ctx.container!.addChild(sprite);
    }
    return () => {
      RemoveSpriteFromWorld(ctx.worldId!, sprite);
      sprite.destroy();
    };
  });
}

export function useCollisionHandler(bodyId: b2BodyId, config: () => EntityCollisionConfig) {
  const collision = useCollision();
  onMount(() => {
    collision.add(bodyId, config());
    return () => collision.remove(bodyId);
  });
}

/**
 * Subscribe to a game event inside `defineEntity` / `attach` (or any active entity scope).
 * Returns an unsubscribe function from `EventContext.on` — mounted as an effect so it
 * is torn down when the entity unmounts.
 */
export function useGameEvent<K extends GameEventName>(event: K, listener: (payload: GameEventPayload<K>) => void) {
  onMount(() => {
    return getGameContext().events.on(event, listener);
  });
}

export function useUpdate(handler: (delta: number) => void) {
  const systems = getGameContext().systems;
  let clean = false;

  onCleanup(() => {
    clean = true;
    systems.unregister('update', handler);
  });

  return {
    start() {
      if (clean) return;
      systems.register('update', handler);
    },
    stop() {
      if (clean) return;
      systems.unregister('update', handler);
    },
  };
}

export function useImmediateUpdate(handler: (delta: number) => void) {
  const systems = getGameContext().systems;
  let clean = false;

  onMount(() => {
    systems.register('update', handler);
    return () => {
      clean = true;
      systems.unregister('update', handler);
    };
  });

  return {
    start() {
      if (clean) return;
      systems.register('update', handler);
    },
    stop() {
      if (clean) return;
      systems.unregister('update', handler);
    },
  };
}

export function useChildren() {
  const children = new Set<EntityBase>();
  registerChildren(children);

  onCleanup(() => {
    children.forEach((child) => child.destroy());
  });

  return {
    withChildren<T>(fn: () => T): T {
      return withActiveChildren(children, fn);
    },
  };
}

/**
 * Create an `EventEmitter` whose lifetime is tied to the current entity scope.
 * The emitter is cleared automatically when the entity is destroyed.
 */
export function useEmitter<TMap extends Record<string, any>>(): EventEmitter<TMap> {
  const emitter = new EventEmitter<TMap>();
  onCleanup(() => emitter.clear());
  return emitter;
}

/**
 * Subscribe to an emitter inside a `defineEntity` / `attach` scope.
 * The subscription is removed when the scope is torn down.
 */
export function useSubscribe<TMap extends Record<string, any>, K extends keyof TMap>(
  emitter: EventEmitter<TMap>,
  event: K,
  fn: (payload: TMap[K]) => void,
): void {
  onMount(() => {
    emitter.on(event, fn);
    return () => emitter.off(event, fn);
  });
}

export function useTimeout(callback: () => void, delay: number) {
  const schedule = getGameContext().systems.get(ScheduleSystem);

  onMount(() => {
    const timeout = schedule.schedule(callback, delay);
    return () => timeout();
  });
}

export function useEffect(effectFn: Effect, displayName?: string) {
  onMount(() => {
    return effect(effectFn, displayName);
  });
}
