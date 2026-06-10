import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { getEntitiesOf } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { Door, DOOR_WIDTH } from '@/gameplay/entities/Door';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { addShake } from '@/systems/vfx/actions/camera';
import { playTimeline } from '@/systems/vfx/timeline/load';
import type { Hooks } from '@/systems/vfx/timeline/types';
import { defineSequence } from '@/systems/vfx/types';
import { vfx } from '@/systems/vfx/vfx';
import { b2Body_GetPosition, b2Body_IsValid, b2Body_SetTransform, b2BodyId, b2Rot } from 'phaser-box2d';
import { brickBreak } from '../burst/brickBreak';
import { waterParticles } from '../burst/waterParticles';
import { animate } from 'animejs';

export interface DoorOpenParams {
  bodyIds: b2BodyId[];
  distance: number;
}

/** Fall back to the first live Door entity when params aren't supplied (e.g. from the timeline editor). */
function resolveParams(params: Partial<DoorOpenParams>): DoorOpenParams {
  if (params.bodyIds && params.bodyIds.length > 0) {
    return { bodyIds: params.bodyIds, distance: params.distance ?? 0 };
  }

  const door = getEntitiesOf(Door).find((d) => d.bodyIds.length > 0);
  if (door) {
    const directionFactor = door.openingDirection === 'left' ? 1 : -1;
    return { bodyIds: door.bodyIds, distance: door.length * DOOR_WIDTH * directionFactor };
  }

  return { bodyIds: [], distance: params.distance ?? 0 };
}

export const doorOpen = defineSequence<DoorOpenParams>({
  kind: 'sequence',
  id: 'doorOpen',
  priority: 'critical',
  prewarm: [brickBreak, waterParticles],
  async build(rawParams, ctx) {
    const { camera } = ctx;
    const { bodyIds, distance } = resolveParams(rawParams);

    const gameContext = getGameContext();
    const physics = gameContext.systems.get(PhysicsSystem);

    const pieces = getDoorBodies(bodyIds, distance);

    const door = {
      progress: 0,
    };

    const waterBurst = (p: Piece, count: number) => {
      if (p.pos()) {
        const pos = p.pos();
        if (pos) vfx.play(waterParticles, { x: pos.x, y: pos.y, count });
      }
    };

    const brickBurst = (p: Piece, count: number) => {
      if (p.pos()) {
        const pos = p.pos();
        if (pos) vfx.play(brickBreak, { x: pos.x, y: pos.y, count, intensity: 0 });
      }
    };

    const dustAll = (count: number) => {
      pieces.forEach((p) => brickBurst(p, count));
    };

    const waterAll = (count: number) => {
      pieces.forEach((p) => waterBurst(p, count));
    };

    let puffIndex = 0;

    const stage = { physics, door };
    const hooks: Hooks = {
      clunk: () => {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { speed: 0.7, volume: 0.7 });
        dustAll(18);
      },
      creak: () => {
        sfx.playPitched(ASSETS.sounds_Chest_Open_Creak_3_1, { speed: 0.8, volume: 0.5 });
      },
      puff: () => {
        const p = pieces[puffIndex++ % Math.max(1, pieces.length)];
        if (p) brickBurst(p, 3);
      },
      settle: () => {
        waterAll(10);
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { speed: 1.3, volume: 0.5 });
        sfx.play(ASSETS.sounds_Sell_Building_A, { volume: 0.5 });
      },
      shake: () => {
        addShake(camera, { intensity: 1, frequency: 25, duration: 500 });
      },
      openDoor: () => {
        animate(door, { progress: 1, duration: 1000, onUpdate: () => pieces.forEach((p) => p.open(door.progress)) });
      },
    };

    await playTimeline('doorOpen', { stage, hooks, ctx });
  },
});

// One movable door piece
interface Piece {
  /** Apply the open amount [0..1]. */
  open(progress: number): void;
  /** Current screen position for dust, or null if gone. */
  pos(): { x: number; y: number } | null;
}

function getDoorBodies(bodyIds: b2BodyId[], distance: number): Piece[] {
  const rot = new b2Rot(1, 0);
  return bodyIds.map((id): Piece => {
    const start = b2Body_GetPosition(id).clone();
    const cur = start.clone();
    return {
      open: (progress) => {
        if (!b2Body_IsValid(id)) return;
        cur.x = start.x - distance * progress;
        b2Body_SetTransform(id, cur, rot);
      },
      pos: () => (b2Body_IsValid(id) ? BodyToScreen(id) : null),
    };
  });
}
