import { mountEffect, onCleanup } from '@/core/entity/scope';
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

export function useBodySprite(sprite: Sprite, bodyId: b2BodyId, options?: { offsetX?: number; offsetY?: number }) {
  const ctx = getGameContext();
  const offsetX = options?.offsetX ?? 0;
  const offsetY = options?.offsetY ?? 0;
  mountEffect(() => {
    AddSpriteToWorld(ctx.worldId!, sprite, bodyId, offsetX, offsetY);
    ctx.container!.addChild(sprite);
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
