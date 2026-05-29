import { BodyToScreen } from '@/systems/physics/WorldSprites';
import type { b2BodyId } from 'phaser-box2d';
import type { Container } from 'pixi.js';
import type { PositionSource } from './types';

/**
 * Position sources for `vfx.attach(def, host, params, source)`.
 *
 * A continuous effect anchors to *something that moves* — but it shouldn't care
 * whether that's a physics body, a display object, or a fixed point. These
 * factories produce a `PositionSource` (a per-frame `() => {x,y}`) for each case,
 * so the same trail/aura effect works on a ball, a UI button, or a static spot.
 */

/** Follow a Box2D body, converted to screen space (the common gameplay case). */
export function followBody(bodyId: b2BodyId): PositionSource {
  return () => BodyToScreen(bodyId);
}

/**
 * Follow a PixiJS display object by its global (screen) position. Use for UI:
 * a glow trailing a moving button, sparkles on an animating icon.
 */
export function followNode(node: Container): PositionSource {
  return () => {
    const p = node.getGlobalPosition();
    return { x: p.x, y: p.y };
  };
}

/** Anchor to a fixed screen-space point. */
export function followPoint(x: number, y: number): PositionSource {
  return () => ({ x, y });
}

/**
 * Follow a live `{x,y}` you mutate yourself — handy when the position comes from
 * something that's neither a body nor a node (a tweened value, a cursor).
 */
export function followRef(ref: { x: number; y: number }): PositionSource {
  return () => ({ x: ref.x, y: ref.y });
}
