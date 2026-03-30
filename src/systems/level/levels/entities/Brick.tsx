import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { assert } from '@/core/common/assert';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { BRICK_POWER_UP_DEFS, type BrickPowerUps } from '@/entities/bricks/Brick';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { useBodySprite, useCamera, useCollisionHandler, usePhysics, useWorldId } from '@/hooks/hooks';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_SetUserData, b2BodyType, b2Vec2, CreatePolygon, type b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface BrickEntity extends EntityBase<typeof ENTITY_KINDS.brick> {
  bodyId: b2BodyId;
  powerUp: BrickPowerUps | undefined;
  spawnPos: { x: number; y: number };
  hit(): void;
  destroy(): void;
}

export interface BrickProps {
  bodyId?: b2BodyId;
  spawnPos?: { x: number; y: number };
  debrisEmitter: ParticleEmitter;
  powerUp?: BrickPowerUps;
  onHit?: (brick: BrickEntity) => void;
  onBreak?: (brick: BrickEntity) => void;
}

export const Brick = defineEntity(({ bodyId, spawnPos, debrisEmitter, powerUp, onHit, onBreak }: BrickProps) => {
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
    b2Body_SetUserData(newBodyId, { type: 'brick', powerup: powerUp });
    bodyId = newBodyId;
  } else {
    const pos = b2Body_GetPosition(bodyId);
    spawnPos = { x: pos.x, y: pos.y };
  }

  assert(bodyId, 'Body ID is required');
  assert(spawnPos, 'Spawn position is required');

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;
  const sprite = new Sprite(bg[`bricks_tile_1#0`]);
  sprite.anchor.set(0.5, 0.5);
  useBodySprite(sprite, bodyId);

  if (powerUp) {
    const powerUpSprite = new Sprite((bg as Record<string, any>)[BRICK_POWER_UP_DEFS[powerUp].texture]);
    powerUpSprite.anchor.set(0.5, 0.5);
    useBodySprite(powerUpSprite, bodyId);
  }

  useCollisionHandler(bodyId, () => ({
    tag: 'brick',
    handlers: { ball: () => brick.hit() },
    entity: brick,
  }));

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  const brick: BrickEntity = {
    kind: ENTITY_KINDS.brick,
    bodyId,
    powerUp,
    spawnPos,

    hit() {
      onHit?.(this);

      if (Math.random() < 0.5) {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { volume: 0.25 });
      } else {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { volume: 0.25 });
      }

      shake(camera, { intensity: Math.random() * 1, duration: 300 });

      const { x, y } = BodyToScreen(this.bodyId);
      debrisEmitter.explode(8, x, y);

      onBreak?.(this);

      this.destroy();
    },
    destroy() {
      unmount();
    },
  };

  return brick;
});
