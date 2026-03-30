import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { assert } from '@/core/common/assert';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useBodySprite, useCamera, useCollisionHandler, usePhysics, useWorldId } from '@/hooks/hooks';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_SetUserData, b2BodyType, b2Vec2, CreatePolygon, type b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface StrongBrickEntity extends EntityBase<typeof ENTITY_KINDS.strongBrick> {
  bodyId: b2BodyId;
  spawnPos: { x: number; y: number };
  /** Remaining hits (starts at `initialLife`, typically 2). */
  life: number;
  hit(): void;
  destroy(): void;
}

export interface StrongBrickProps {
  bodyId?: b2BodyId;
  spawnPos?: { x: number; y: number };
  debrisEmitter: ParticleEmitter;
  /** Hits before destruction (default 2). */
  initialLife?: number;
  onHit?: (brick: StrongBrickEntity) => void;
  onBreak?: (brick: StrongBrickEntity) => void;
}

export const StrongBrick = defineEntity(
  ({ bodyId, spawnPos, debrisEmitter, initialLife = 2, onHit, onBreak }: StrongBrickProps): StrongBrickEntity => {
    const physics = usePhysics();
    const camera = useCamera();
    const unmount = getUnmount();

    if (!spawnPos && !bodyId) {
      throw new Error('Spawn position or body ID is required');
    }

    if (!bodyId) {
      const brickVertices = [new b2Vec2(-1, 0.5), new b2Vec2(1, 0.5), new b2Vec2(1, -0.5), new b2Vec2(-1, -0.5)];
      const { bodyId: newBodyId } = CreatePolygon({
        position: new b2Vec2(spawnPos!.x, spawnPos!.y),
        type: b2BodyType.b2_staticBody,
        vertices: brickVertices,
        worldId: useWorldId(),
      });
      b2Body_SetUserData(newBodyId, { type: 'strong-brick', life: initialLife });
      bodyId = newBodyId;
    } else {
      const pos = b2Body_GetPosition(bodyId);
      spawnPos = { x: pos.x, y: pos.y };
      b2Body_SetUserData(bodyId, { type: 'strong-brick', life: initialLife });
    }

    assert(bodyId, 'Body ID is required');
    assert(spawnPos, 'Spawn position is required');

    const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
    const sprite = new Sprite(bg[`bricks_tile_3#0`]);
    sprite.anchor.set(0.5, 0.5);
    useBodySprite(sprite, bodyId);

    useCollisionHandler(bodyId, () => ({
      tag: 'strong-brick',
      handlers: { ball: () => strongBrick.hit() },
      entity: strongBrick,
    }));

    onCleanup(() => {
      physics.queueDestruction(bodyId);
    });

    const strongBrick: StrongBrickEntity = {
      kind: ENTITY_KINDS.strongBrick,
      bodyId,
      spawnPos,
      life: initialLife,
      hit() {
        onHit?.(this);

        if (Math.random() < 0.5) {
          sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { volume: 0.25 });
        } else {
          sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { volume: 0.25 });
        }

        if (this.life > 1) {
          this.life -= 1;
          b2Body_SetUserData(bodyId, { type: 'strong-brick', life: this.life });
          sprite.texture = bg[`bricks_tile_4#0`];

          const { x, y } = BodyToScreen(this.bodyId);
          debrisEmitter.explode(2, x, y);
          shake(camera, { intensity: Math.random() * 0.25, duration: 300 });
          return;
        }

        const { x, y } = BodyToScreen(this.bodyId);
        debrisEmitter.explode(12, x, y);
        shake(camera, { intensity: Math.random() * 1.25, duration: 300 });

        onBreak?.(this);
        this.destroy();
      },
      destroy() {
        unmount();
      },
    };

    return strongBrick;
  },
);
