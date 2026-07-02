import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import { assert } from '@/core/common/assert';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import type { EventEmitter } from '@/core/game/EventEmitter';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { getRunState } from '@/data/game-state';
import { useCamera, useCollisionHandler, useEmitter, usePhysics } from '@/hooks/hooks';
import { PhysicsLayer, setBodyCategoryBits } from '@/systems/physics/PhysicsLayers';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_SetUserData, type b2BodyId } from 'phaser-box2d';

export type WoodenBrickEvents = {
  broken: { x: number; y: number };
};

export interface WoodenBrickEntity extends EntityBase {
  bodyId: b2BodyId;
  spawnPos: { x: number; y: number };
  events: EventEmitter<WoodenBrickEvents>;
  hit(): void;
}

export interface WoodenBrickProps {
  bodyId: b2BodyId;
  debrisEmitter: ParticleEmitter;
  onHit?: (brick: WoodenBrickEntity) => void;
  onBreak?: (brick: WoodenBrickEntity) => void;
}

export const WoodenBrick = defineEntity(({ bodyId, debrisEmitter, onHit, onBreak }: WoodenBrickProps) => {
  const physics = usePhysics();
  const camera = useCamera();

  const pos = b2Body_GetPosition(bodyId);
  const spawnPos = { x: pos.x, y: pos.y };
  b2Body_SetUserData(bodyId, { type: 'wooden-brick' });

  assert(bodyId, 'Body ID is required');
  assert(spawnPos, 'Spawn position is required');
  setBodyCategoryBits(bodyId, PhysicsLayer.BRICK);

  const events = useEmitter<WoodenBrickEvents>();

  let cheeseBreaksBricks = false;
  getRunState().crewBoons.aura_cheeseBreaksBricks.subscribe((value) => {
    cheeseBreaksBricks = value;
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'wooden-brick',
    handlers: {
      ball: () => woodenBrick.hit(),
      cheese: () => {
        if (cheeseBreaksBricks) {
          woodenBrick.hit();
        }
      },
    },
    entity: woodenBrick,
  }));

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  const woodenBrick = entity<WoodenBrickEntity>({
    bodyId,
    spawnPos,
    events,
    hit() {
      // TODO: events.emit('hit');
      onHit?.(this);

      if (Math.random() < 0.5) {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { volume: 0.25 });
      } else {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { volume: 0.25 });
      }

      const { x, y } = BodyToScreen(this.bodyId);
      debrisEmitter.explode(12, x, y);
      shake(camera, { intensity: Math.random() * 1.25, duration: 300 });

      events.emit('broken', { x: this.spawnPos.x, y: this.spawnPos.y });
      onBreak?.(this);

      this.destroy();
    },
  });

  return woodenBrick;
});
