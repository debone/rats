import { ASSETS } from '@/assets';
import { getTextureMetadata, makeTextureLabel } from '@/core/assets/utils';
import { sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { assert } from '@/core/common/assert';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import type { EventEmitter } from '@/core/game/EventEmitter';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { getRunState } from '@/data/game-state';
import { useBodySprite, useCamera, useCollisionHandler, useEmitter, usePhysics, useWorldId } from '@/hooks/hooks';
import { PhysicsLayer, setBodyCategoryBits } from '@/systems/physics/PhysicsLayers';
import { BodyToScreen, GetSpritesFromBody } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_SetUserData, b2BodyType, b2Vec2, CreatePolygon, type b2BodyId } from 'phaser-box2d';
import { Assets, Sprite } from 'pixi.js';

export type ConcreteBrickEvents = {
  broken: { x: number; y: number };
};

export interface ConcreteBrickEntity extends EntityBase {
  bodyId: b2BodyId;
  spawnPos: { x: number; y: number };
  /** Remaining hits (starts at `initialLife`, typically 2). */
  life: number;
  events: EventEmitter<ConcreteBrickEvents>;
  hit(points: number): void;
}

export interface ConcreteBrickProps {
  bodyId?: b2BodyId;
  spawnPos?: { x: number; y: number };
  debrisEmitter: ParticleEmitter;
  /** Hits before destruction (default 2). */
  initialLife?: number;
  onHit?: (brick: ConcreteBrickEntity) => void;
  onBreak?: (brick: ConcreteBrickEntity) => void;
}

export const ConcreteBrick = defineEntity(
  ({ bodyId, spawnPos, debrisEmitter, initialLife = 8, onHit, onBreak }: ConcreteBrickProps) => {
    const physics = usePhysics();
    const camera = useCamera();
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
      b2Body_SetUserData(newBodyId, { type: 'concrete-brick', life: initialLife });
      bodyId = newBodyId;
    } else {
      const pos = b2Body_GetPosition(bodyId);
      spawnPos = { x: pos.x, y: pos.y };
      b2Body_SetUserData(bodyId, { type: 'concrete-brick', life: initialLife });
    }

    assert(bodyId, 'Body ID is required');
    assert(spawnPos, 'Spawn position is required');
    setBodyCategoryBits(bodyId, PhysicsLayer.BRICK);

    const events = useEmitter<ConcreteBrickEvents>();

    const bg = Assets.get(ASSETS.prototype).textures;
    let sprite!: Sprite;
    const bodySprites = GetSpritesFromBody(worldId, bodyId);

    if (bodySprites.length === 0) {
      sprite = new Sprite(bg[`bricks_tile_3#0`]);
      sprite.anchor.set(0.5, 0.5);
      useBodySprite(sprite, bodyId);
    } else {
      sprite = bodySprites[0] as Sprite;
    }

    let cheeseBreaksBricks = false;
    getRunState().crewBoons.aura_cheeseBreaksBricks.subscribe((value) => {
      cheeseBreaksBricks = value;
    });

    useCollisionHandler(bodyId, () => ({
      tag: 'concrete-brick',
      handlers: {
        ball: () => concreteBrick.hit(getRunState().stats.ballDamage.get()),
        cheese: () => {
          if (cheeseBreaksBricks) {
            concreteBrick.hit(1);
          }
        },
      },
      entity: concreteBrick,
    }));

    onCleanup(() => {
      physics.queueDestruction(bodyId);
    });

    const textureMetadata = getTextureMetadata(sprite.texture);
    const initialTile = textureMetadata.tile;

    const concreteBrick = entity<ConcreteBrickEntity>({
      bodyId,
      spawnPos,
      events,
      life: initialLife,
      hit(points: number) {
        // TODO: events.emit('hit');
        onHit?.(this);

        if (Math.random() < 0.5) {
          sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { volume: 0.25 });
        } else {
          sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { volume: 0.25 });
        }

        this.life = Math.max(this.life - points, 0);

        if (this.life > 0) {
          b2Body_SetUserData(bodyId, { type: 'concrete-brick', life: this.life });
          sprite.texture =
            bg[
              makeTextureLabel({
                label: textureMetadata.label,
                tile: initialTile + Math.floor((initialLife - this.life) / 2),
                frame: 0,
              })
            ];

          const { x, y } = BodyToScreen(this.bodyId);
          debrisEmitter.explode(2, x, y);
          shake(camera, { intensity: Math.random() * 0.25, duration: 300 });
          return;
        }

        const { x, y } = BodyToScreen(this.bodyId);
        debrisEmitter.explode(12, x, y);
        shake(camera, { intensity: Math.random() * 1.25, duration: 300 });

        // TODO: improve this once all the levels are the same
        if (getRunState().crewBoons.lacfree_nextBricksHaveCheese.get() > 0) {
          getRunState().crewBoons.lacfree_nextBricksHaveCheese.update((v) => v - 1);
          throw new Error('TODO');
          // strongBrick.powerUp = 'yellow';
        }

        events.emit('broken', { x: this.spawnPos.x, y: this.spawnPos.y });
        onBreak?.(this);

        this.destroy();
      },
    });

    return concreteBrick;
  },
);
