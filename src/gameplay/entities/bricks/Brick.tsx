import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { assert } from '@/core/common/assert';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import type { EventEmitter } from '@/core/game/EventEmitter';
import { getRunState } from '@/data/game-state';
import { BRICK_POWER_UP_DEFS, type BrickPowerUps } from '@/entities/bricks/Brick';
import { brickBreak } from '@/gameplay/vfx/burst/brickBreak';
import { useBodySprite, useCollisionHandler, useEmitter, usePhysics, useWorldId } from '@/hooks/hooks';
import { PhysicsLayer, setBodyCategoryBits } from '@/systems/physics/PhysicsLayers';
import { BodyToScreen, GetSpritesFromBody } from '@/systems/physics/WorldSprites';
import { vfx } from '@/systems/vfx/vfx';
import { b2Body_GetPosition, b2Body_SetUserData, b2BodyType, b2Vec2, CreatePolygon, type b2BodyId } from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export type BrickEvents = {
  hit: void;
  broken: { x: number; y: number; powerUp: BrickPowerUps | undefined };
  unbroken: BrickEntity;
};

export interface BrickEntity extends EntityBase {
  bodyId: b2BodyId;
  powerUp: BrickPowerUps | undefined;
  spawnPos: { x: number; y: number };
  events: EventEmitter<BrickEvents>;
  hit(): void;
  unbreak(): BrickEntity;
}

export interface BrickProps {
  bodyId?: b2BodyId;
  spawnPos?: { x: number; y: number };
  powerUp?: BrickPowerUps;
}

export const Brick = defineEntity(({ bodyId, spawnPos, powerUp }: BrickProps) => {
  const physics = usePhysics();
  const worldId = useWorldId();

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
  setBodyCategoryBits(bodyId, PhysicsLayer.BRICK);

  const events = useEmitter<BrickEvents>();

  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

  if (GetSpritesFromBody(worldId, bodyId).length === 0) {
    const sprite = new Sprite(bg[`bricks_tile_1#0`]);
    sprite.anchor.set(0.5, 0.5);
    useBodySprite(sprite, bodyId);
  }

  if (powerUp) {
    const powerUpSprite = new Sprite((bg as Record<string, any>)[BRICK_POWER_UP_DEFS[powerUp].texture]);
    powerUpSprite.anchor.set(0.5, 0.5);
    useBodySprite(powerUpSprite, bodyId);
  }

  let cheeseBreaksBricks = false;
  getRunState().crewBoons.aura_cheeseBreaksBricks.subscribe((value) => {
    cheeseBreaksBricks = value;
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'brick',
    handlers: {
      ball: () => brick.hit(),
      cheese: () => {
        if (cheeseBreaksBricks) {
          brick.hit();
        }
      },
    },
    entity: brick,
  }));

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  const brick = entity<BrickEntity>({
    bodyId,
    powerUp,
    spawnPos,
    events,

    hit() {
      events.emit('hit');

      if (Math.random() < 0.5) {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { volume: 0.25 });
      } else {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { volume: 0.25 });
      }

      const { x, y } = BodyToScreen(this.bodyId);
      // TODO: get the angle of the collision and make it the intensity
      vfx.play(brickBreak, { x, y, intensity: Math.random() });

      if (getRunState().crewBoons.lacfree_nextBricksHaveCheese.get() > 0) {
        getRunState().crewBoons.lacfree_nextBricksHaveCheese.update((v) => v - 1);
        brick.powerUp = 'yellow';
      }

      events.emit('broken', { x: this.spawnPos.x, y: this.spawnPos.y, powerUp: this.powerUp });

      this.destroy();
    },

    unbreak(): BrickEntity {
      return Brick({
        spawnPos,
        powerUp,
      });
    },
  });

  return brick;
});
