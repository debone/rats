/**
 * World Sprites - Production rendering for Box2D bodies
 *
 * Associates PixiJS display objects with Box2D bodies and syncs their transforms.
 * Unlike PhaserDebugDraw which is for debugging visualization, this handles
 * actual game sprites that render the visual representation of physics bodies.
 */

import { PXM, MIN_WIDTH, MIN_HEIGHT } from '@/consts';
import { b2Body_GetTransform, b2Body_IsValid, b2DestroyBody, type b2BodyId, type b2WorldId } from 'phaser-box2d';

/**
 * Sprite-like object that can be positioned and rotated.
 * Compatible with PixiJS Container, Sprite, Graphics, etc.
 */
export interface SpriteObject {
  x: number;
  y: number;
  rotation: number;
  visible?: boolean;
}

/** Entry storing body reference and optional metadata */
interface SpriteEntry {
  bodyId: b2BodyId;
  /** Offset from body center in pixels (after scaling) */
  offsetX?: number;
  offsetY?: number;
}

/** Map of sprites to their body entries per world */
const WorldSprites = new Map<b2WorldId, Map<SpriteObject, SpriteEntry>>();

/** Coordinate origin offset - configurable per world */
const WorldOrigins = new Map<b2WorldId, { x: number; y: number }>();

export function WorldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  return { x: worldX * PXM, y: -worldY * PXM };
}

export function ScreenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  return { x: screenX / PXM, y: -screenY / PXM };
}

/**
 * Sets the coordinate origin for a world.
 * Default is center of MIN_WIDTH x MIN_HEIGHT viewport.
 *
 * @param worldId - The Box2D world ID
 * @param originX - X coordinate of the origin in pixels
 * @param originY - Y coordinate of the origin in pixels
 */
export function SetWorldOrigin(worldId: b2WorldId, originX: number, originY: number): void {
  WorldOrigins.set(worldId, { x: originX, y: originY });
}

/**
 * Gets the coordinate origin for a world.
 *
 * @param worldId - The Box2D world ID
 * @returns The origin coordinates in pixels
 */
export function GetWorldOrigin(worldId: b2WorldId): { x: number; y: number } {
  return WorldOrigins.get(worldId) ?? { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 };
}

/**
 * Adds a sprite to the given world, attaching it to the given body.
 *
 * @param worldId - The Box2D world ID
 * @param sprite - The sprite/container to attach
 * @param bodyId - The Box2D body ID
 * @param offsetX - Optional X offset from body center (in pixels)
 * @param offsetY - Optional Y offset from body center (in pixels)
 */
export function AddSpriteToWorld(
  worldId: b2WorldId,
  sprite: SpriteObject,
  bodyId: b2BodyId,
  offsetX = 0,
  offsetY = 0,
): void {
  if (!WorldSprites.has(worldId)) {
    WorldSprites.set(worldId, new Map());
  }

  WorldSprites.get(worldId)!.set(sprite, {
    bodyId,
    offsetX,
    offsetY,
  });
}

/**
 * Removes a sprite from the given world, optionally destroying the body.
 *
 * @param worldId - The Box2D world ID
 * @param sprite - The sprite to remove
 * @param destroyBody - Whether to destroy the Box2D body (default: false)
 */
export function RemoveSpriteFromWorld(worldId: b2WorldId, sprite: SpriteObject, destroyBody = false): void {
  if (!WorldSprites.has(worldId)) return;

  const worldMap = WorldSprites.get(worldId)!;
  const entry = worldMap.get(sprite);

  if (entry && destroyBody) {
    if (b2Body_IsValid(entry.bodyId)) {
      b2DestroyBody(entry.bodyId);
    }
  }

  worldMap.delete(sprite);
}

/**
 * Clears all sprite-body pairs from a world.
 * Neither the sprites nor the bodies are destroyed.
 *
 * @param worldId - The Box2D world ID
 */
export function ClearWorldSprites(worldId: b2WorldId): void {
  if (WorldSprites.has(worldId)) {
    WorldSprites.get(worldId)!.clear();
  }
}

/**
 * Destroys all data associated with a world.
 * Call this when destroying the Box2D world.
 *
 * @param worldId - The Box2D world ID
 */
export function DestroyWorldSprites(worldId: b2WorldId): void {
  WorldSprites.delete(worldId);
  WorldOrigins.delete(worldId);
}

/**
 * Returns the body attached to the given sprite in the given world.
 *
 * @param worldId - The Box2D world ID
 * @param sprite - The sprite to look up
 * @returns The body ID, or null if not found
 */
export function GetBodyFromSprite(worldId: b2WorldId, sprite: SpriteObject): b2BodyId | null {
  if (!WorldSprites.has(worldId)) return null;

  const entry = WorldSprites.get(worldId)!.get(sprite);
  return entry?.bodyId ?? null;
}

/**
 * Returns the sprite attached to the given body in the given world.
 *
 * @param worldId - The Box2D world ID
 * @param bodyId - The body ID to look up
 * @returns The sprite, or null if not found
 */
export function GetSpriteFromBody(worldId: b2WorldId, bodyId: b2BodyId): SpriteObject | null {
  if (!WorldSprites.has(worldId)) return null;

  for (const [sprite, entry] of WorldSprites.get(worldId)!) {
    // TODO: hi Victor from future, I'm sorry if this comparison is not correct
    if (entry.bodyId.index1 === bodyId.index1) {
      return sprite;
    }
  }

  return null;
}

/**
 * Updates all sprites in a world to match their body transforms.
 *
 * Call this each frame after b2World_Step.
 *
 * @param worldId - The Box2D world ID
 */
export function UpdateWorldSprites(worldId: b2WorldId): void {
  if (!WorldSprites.has(worldId)) return;

  const origin = GetWorldOrigin(worldId);

  WorldSprites.get(worldId)!.forEach((entry, sprite) => {
    if (!b2Body_IsValid(entry.bodyId)) {
      // Body was destroyed - hide sprite but don't remove from map
      // (let the game code handle cleanup)
      if (sprite.visible !== undefined) {
        sprite.visible = false;
      }
      return;
    }

    BodyToSprite(entry.bodyId, sprite, origin, entry.offsetX, entry.offsetY);
  });
}

/**
 * Converts a Box2D body's position and rotation to sprite coordinates.
 *
 * Coordinate system:
 * - Box2D: Center origin, Y-up, units in meters
 * - PixiJS: Top-left origin (but we use center), Y-down, units in pixels
 *
 * @param bodyId - The Box2D body ID
 * @param sprite - The sprite to update
 * @param origin - The coordinate origin in pixels (default: center of viewport)
 * @param offsetX - Optional X offset from body center (in pixels)
 * @param offsetY - Optional Y offset from body center (in pixels)
 */
export function BodyToSprite(
  bodyId: b2BodyId,
  sprite: SpriteObject,
  origin = { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 },
  offsetX = 0,
  offsetY = 0,
): void {
  const transform = b2Body_GetTransform(bodyId);

  const { x, y } = WorldToScreen(transform.p.x, transform.p.y);

  // Convert position: scale and flip Y axis
  sprite.x = x + origin.x + offsetX;
  sprite.y = y + origin.y + offsetY;

  // Convert rotation: negate because Y is flipped
  sprite.rotation = -Math.atan2(transform.q.s, transform.q.c);
}

/**
 * Converts sprite coordinates to Box2D body position (in meters).
 * Useful for placing bodies based on sprite positions.
 *
 * @param spriteX - Sprite X position in pixels
 * @param spriteY - Sprite Y position in pixels
 * @param origin - The coordinate origin in pixels (default: center of viewport)
 * @returns Position in Box2D coordinates (meters)
 */
export function SpriteToBodyPosition(
  spriteX: number,
  spriteY: number,
  origin = { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 },
): { x: number; y: number } {
  return {
    x: (spriteX - origin.x) / PXM,
    y: -(spriteY - origin.y) / PXM,
  };
}

/**
 * Gets the number of sprite-body pairs in a world.
 *
 * @param worldId - The Box2D world ID
 * @returns The number of pairs
 */
export function GetWorldSpriteCount(worldId: b2WorldId): number {
  return WorldSprites.get(worldId)?.size ?? 0;
}

/**
 * Iterates over all sprite-body pairs in a world.
 *
 * @param worldId - The Box2D world ID
 * @param callback - Function called for each pair
 */
export function ForEachWorldSprite(
  worldId: b2WorldId,
  callback: (sprite: SpriteObject, bodyId: b2BodyId) => void,
): void {
  if (!WorldSprites.has(worldId)) return;

  WorldSprites.get(worldId)!.forEach((entry, sprite) => {
    callback(sprite, entry.bodyId);
  });
}
