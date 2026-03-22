import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { shake } from '@/core/camera/effects/shake';
import { ENTITY_KINDS, type EntityBase } from '@/core/entity/entity-kinds';
import { defineEntity, onCleanup } from '@/core/entity/scope';
import { useBodySprite, useCamera, usePhysics, useWorldId } from '@/hooks/hooks';
import { animate } from 'animejs';
import {
  b2Body_GetPosition,
  b2Body_SetTransform,
  b2Body_SetUserData,
  b2BodyType,
  b2Rot,
  b2Vec2,
  CreatePolygon,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface DoorEntity extends EntityBase<typeof ENTITY_KINDS.door> {
  bodyIds: b2BodyId[];
  spawnPos: { x: number; y: number };
  closed: boolean;
  length: number;
  openingDirection: 'left' | 'right';
  open(): void;
}

export interface DoorProps {
  spawnPos: { x: number; y: number };
  length: number;
  openingDirection?: 'left' | 'right';
}

export const Door = defineEntity(({ spawnPos, length, openingDirection = 'left' }: DoorProps): DoorEntity => {
  const worldId = useWorldId();
  const physics = usePhysics();
  const camera = useCamera();

  const doorPos = new b2Vec2(spawnPos.x, spawnPos.y);

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

  const doorWidth = 2;
  const doorVertices = [new b2Vec2(-1, 0.5), new b2Vec2(1, 0.5), new b2Vec2(1, -0.5), new b2Vec2(-1, -0.5)];
  const bodyIds: b2BodyId[] = [];

  for (let i = 0; i < length; i++) {
    const { bodyId } = CreatePolygon({
      position: new b2Vec2(doorPos.x + i * doorWidth, doorPos.y),
      type: b2BodyType.b2_staticBody,
      vertices: doorVertices,
      worldId,
    });
    b2Body_SetUserData(bodyId, { type: 'door' });
    bodyIds.push(bodyId);

    const sprite = new Sprite(bg[`bricks_tile_2#0`]);
    sprite.anchor.set(0.5, 0.5);
    useBodySprite(sprite, bodyId);
  }

  onCleanup(() => {
    bodyIds.forEach((bodyId) => {
      physics.queueDestruction(bodyId);
    });
  });

  const door: DoorEntity = {
    kind: ENTITY_KINDS.door,
    bodyIds,
    spawnPos,
    closed: true,
    length,
    openingDirection,
    open() {
      this.closed = false;
      const duration = 1500;

      const openingDirectionFactor = this.openingDirection === 'left' ? 1 : -1;

      shake(camera, { intensity: 1, frequency: 25, duration });

      for (const bodyId of bodyIds) {
        const pos = b2Body_GetPosition(bodyId);
        const rootPos = pos.clone();
        const rot = new b2Rot(1, 0);

        animate(rootPos, {
          x: pos.x - length * doorWidth * openingDirectionFactor,
          duration,
          onUpdate: () => {
            b2Body_SetTransform(bodyId, rootPos, rot);
          },
        });
      }
    },
  };

  return door;
});
