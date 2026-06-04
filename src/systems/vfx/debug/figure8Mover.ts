import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { useImmediateUpdate, useWorldId } from '@/hooks/hooks';
import {
  b2Body_SetTransform,
  b2BodyType,
  b2DestroyBody,
  b2MakeRot,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
  b2Vec2,
  CreateCircle,
  type b2BodyId,
  type b2ShapeId,
} from 'phaser-box2d';

/**
 * A debug-only host that drives a collision-free Box2D body around a figure-8,
 * so continuous (attached) VFX — ball trails, auras — can be previewed without a
 * real ball. It satisfies the structural host contract those effects expect
 * (`bodyId` + `active`), and tears the body down on destroy.
 *
 * World origin (0,0) maps to screen center; the path spans most of the playfield.
 */
export interface Figure8MoverEntity extends EntityBase {
  bodyId: b2BodyId;
  active: boolean;
}

const NO_ROT = b2MakeRot(0);
const AMP_X = 7; // metres — ~half the playfield width
const AMP_Y = 4; // metres
const SPEED = 2; // radians / second

export const Figure8Mover = defineEntity(() => {
  const worldId = useWorldId();

  // The bundled box2d .d.ts has duplicated result declarations; cast to the
  // shape we actually get back ({ bodyId, shapeId }).
  const { bodyId, shapeId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_staticBody,
    position: new b2Vec2(0, 0),
    radius: 0.25,
  }) as { bodyId: b2BodyId; shapeId: b2ShapeId };

  // Ghost: collide with nothing so the preview never disturbs gameplay.
  const filter = b2Shape_GetFilter(shapeId);
  filter.categoryBits = 0;
  filter.maskBits = 0;
  b2Shape_SetFilter(shapeId, filter);

  const pos = new b2Vec2(0, 0);
  let t = 0;

  useImmediateUpdate((dtMs) => {
    t += (dtMs / 1000) * SPEED;
    pos.x = Math.sin(t) * AMP_X;
    pos.y = Math.sin(t * 2) * AMP_Y; // sin(2t) → figure-8
    b2Body_SetTransform(bodyId, pos, NO_ROT);
  });

  onCleanup(() => {
    try {
      b2DestroyBody(bodyId);
    } catch {
      // World may already be torn down on screen unload; ignore.
    }
  });

  return entity<Figure8MoverEntity>({ bodyId, active: true });
});
