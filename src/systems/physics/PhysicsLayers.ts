import {
  b2Body_GetShapeCount,
  b2Body_GetShapes,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
  type b2BodyId,
  type b2ShapeId,
} from 'phaser-box2d';

/**
 * Box2D collision category bits used across the game.
 *
 * DEFAULT covers every body that doesn't need selective filtering — walls,
 * paddle, cheese, scrap, all Godot-authored geometry. No Godot migration
 * required: new bodies without an explicit categoryBits stay at 0x0001.
 *
 * BRICK is the only layer that currently needs to be toggled at runtime
 * (ghost-ball mode). Add new layers here as the need arises; keep the list
 * small so the bit-mask arithmetic stays readable.
 */
export const PhysicsLayer = {
  DEFAULT:   1 << 0, // 0x0001 — walls, paddle, most Godot geo
  BALL:      1 << 1, // 0x0002 — NormBall (already set at creation)
  BRICK:     1 << 2, // 0x0004 — Brick + StrongBrick
  CAT_PIECE: 1 << 3, // 0x0008 — cat-body + cat-tail (stamped at runtime;
                     //           Godot geometry uses categoryBits=2 which
                     //           we override to keep them in their own layer)
} as const;

/** Ball collides with everything it normally should. */
export const BALL_MASK_NORMAL = PhysicsLayer.DEFAULT | PhysicsLayer.BRICK | PhysicsLayer.CAT_PIECE;

/**
 * Ghost-ball mode: bricks are excluded so the ball phases through them.
 * Cat pieces stay in the mask so the ball still bounces off the cat.
 */
export const BALL_MASK_GHOST = PhysicsLayer.DEFAULT | PhysicsLayer.CAT_PIECE;

/**
 * Set the categoryBits on every shape belonging to a body.
 * Works for both programmatically-created bodies and Godot-geometry bodies
 * (where the shapeId is not directly available at construction time).
 */
export function setBodyCategoryBits(bodyId: b2BodyId, categoryBits: number): void {
  setBodyFilter(bodyId, categoryBits, undefined);
}

/**
 * Set categoryBits and/or maskBits on every shape belonging to a body.
 * Pass `undefined` for either parameter to leave it unchanged.
 */
export function setBodyFilter(bodyId: b2BodyId, categoryBits: number | undefined, maskBits: number | undefined): void {
  const count = b2Body_GetShapeCount(bodyId);
  const shapes: b2ShapeId[] = new Array(count);
  b2Body_GetShapes(bodyId, shapes);
  for (const shapeId of shapes) {
    const filter = b2Shape_GetFilter(shapeId);
    if (categoryBits !== undefined) filter.categoryBits = categoryBits;
    if (maskBits !== undefined) filter.maskBits = maskBits;
    b2Shape_SetFilter(shapeId, filter);
  }
}
