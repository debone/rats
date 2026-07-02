import { assert } from '@/core/common/assert';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { useCollisionHandler, usePhysics } from '@/hooks/hooks';
import { PhysicsLayer, setBodyCategoryBits } from '@/systems/physics/PhysicsLayers';
import { b2Body_GetPosition, b2Body_SetUserData, type b2BodyId } from 'phaser-box2d';

export interface StaticShapeEntity extends EntityBase {
  bodyId: b2BodyId;
  spawnPos: { x: number; y: number };
}

export interface StaticShapeProps {
  bodyId: b2BodyId;
}

export const StaticShape = defineEntity(({ bodyId }: StaticShapeProps) => {
  const physics = usePhysics();

  const pos = b2Body_GetPosition(bodyId);
  const spawnPos = { x: pos.x, y: pos.y };
  b2Body_SetUserData(bodyId, { type: 'static-shape' });

  assert(bodyId, 'Body ID is required');
  assert(spawnPos, 'Spawn position is required');
  setBodyCategoryBits(bodyId, PhysicsLayer.DEFAULT);

  useCollisionHandler(bodyId, () => ({
    tag: 'static-shape',
    handlers: {},
    entity: staticShape,
  }));

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  const staticShape = entity<StaticShapeEntity>({
    bodyId,
    spawnPos,
  });

  return staticShape;
});
