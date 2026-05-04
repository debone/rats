import { mountEffect, onCleanup, withActiveChildren, type EntityBase } from '@/core/entity/scope';
import type { GameEventName, GameEventPayload } from '@/data/events';
import { getGameContext } from '@/data/game-context';
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
  options?: { offsetX?: number; offsetY?: number; z?: number },
) {
  const ctx = getGameContext();
  const offsetX = options?.offsetX ?? 0;
  const offsetY = options?.offsetY ?? 0;
  mountEffect(() => {
    AddSpriteToWorld(ctx.worldId!, sprite, bodyId, offsetX, offsetY);
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
  mountEffect(() => {
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
  mountEffect(() => {
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

export function useChildren() {
  const children = new Set<EntityBase>();
  onCleanup(() => {
    children.forEach((c) => c.destroy());
  });
  return {
    withChildren<T>(fn: () => T): T {
      return withActiveChildren(children, fn);
    },
  };
}

export function useImmediateUpdate(handler: (delta: number) => void) {
  const systems = getGameContext().systems;
  let clean = false;

  mountEffect(() => {
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
