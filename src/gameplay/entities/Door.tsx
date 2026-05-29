import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { doorOpen } from '@/core/vfx/effects/doorOpen';
import { vfx } from '@/core/vfx/vfx';
import { defineEntity, entity, onMount, onCleanup, type EntityBase } from '@/core/entity/scope';
import { useBodySprite, usePhysics, useWorldId } from '@/hooks/hooks';
import {
  b2Body_SetUserData,
  b2BodyType,
  b2Vec2,
  CreatePolygon,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface DoorEntity extends EntityBase {
  name?: string;
  bodyIds: b2BodyId[];
  spawnPos: { x: number; y: number };
  closed: boolean;
  length: number;
  setLength(length: number): void;
  openingDirection: 'left' | 'right';
  open(): void;
}

export interface DoorProps {
  name?: string;
  spawnPos: { x: number; y: number };
  length: number;
  openingDirection?: 'left' | 'right';
  startOpen?: boolean;
  sound?: string;
}

export const Door = defineEntity(
  ({ spawnPos, length, name, openingDirection = 'left', startOpen = false, sound }: DoorProps) => {
    const worldId = useWorldId();
    const physics = usePhysics();

    const doorPos = new b2Vec2(spawnPos.x, spawnPos.y);

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

    const doorWidth = 2;
    const doorVertices = [new b2Vec2(-1, 0.5), new b2Vec2(1, 0.5), new b2Vec2(1, -0.5), new b2Vec2(-1, -0.5)];
    let bodyIds: b2BodyId[] = [];

    onCleanup(() => {
      bodyIds.forEach((bodyId) => {
        physics.queueDestruction(bodyId);
      });
    });

    onMount(() => {
      door.setLength(length);
    });

    const door = entity<DoorEntity>({
      name,
      bodyIds,
      spawnPos,
      closed: true,
      length,
      openingDirection,
      open() {
        if (!this.closed) {
          return;
        }

        this.closed = false;

        // The whole open — freeze, dust, grind, spark, unfreeze — is a scripted
        // VFX sequence. Bake door geometry (length, width, direction) into a
        // signed distance and hand off; the sequence owns physics freeze, sounds,
        // particles and the body slide on one timeline.
        const openingDirectionFactor = this.openingDirection === 'left' ? 1 : -1;
        const distance = door.length * doorWidth * openingDirectionFactor;
        vfx.play(doorOpen, { bodyIds, distance, sound });
      },
      setLength(length: number) {
        door.length = length;

        bodyIds.forEach((bodyId) => {
          physics.queueDestruction(bodyId);
        });

        bodyIds = [];

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
      },
    });

    onMount(() => {
      if (startOpen) {
        setTimeout(() => {
          door.open();
        }, 100);
      }
    });

    return door;
  },
);
