import { ASSETS } from '@/assets';
import { assert } from '@/core/common/assert';
import { defineEntity } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { useChildren } from '@/hooks/hooks';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid, type b2BodyId, type b2JointId } from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { Brick } from './Brick';
import { Door } from './Door';
import { Wall, wallSparkOnBall } from './Wall';
import { BrickDebrisParticles } from './particles/BrickDebrisParticles';
import { WallParticles } from './particles/WallParticles';

export interface BodyUserData {
  type: string;
  powerup?: BrickPowerUps;
  doorName?: string;
}

export interface BodyEntry {
  bodyId: b2BodyId;
  tag: string | undefined;
  userData: BodyUserData | null;
}

export interface BreakoutPhysicsProps {
  levelId: string;
  rubeAsset: string;
}

export const BreakoutPhysics = defineEntity(({ levelId, rubeAsset }: BreakoutPhysicsProps) => {
  const { withChildren } = useChildren();
  const ctx = getGameContext();

  const rube = Assets.get(rubeAsset);
  const { loadedBodies, loadedJoints } = loadSceneIntoWorld(rube, ctx.worldId!);

  const particles = withChildren(() => ({
    brickDebris: BrickDebrisParticles(),
    wall: WallParticles(),
  }));

  const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
  assert(paddleJoint, `${levelId}: paddle-joint not found in RUBE`);

  const nonStandardBodies: BodyEntry[] = [];

  withChildren(() => {
    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;

      const userData = b2Body_GetUserData(bodyId) as BodyUserData | null;
      const tag = userData?.type;

      if (tag === 'left-wall' || tag === 'right-wall' || tag === 'top-wall') {
        Wall({ bodyId, wallCollisionTag: tag, onBall: wallSparkOnBall(tag, particles.wall.emitter) });
      } else if (tag === 'exit') {
        // TODO: wire via Wall events once Wall gets events support
      } else if (tag === 'bottom-wall') {
        // TODO: wire via Wall events once Wall gets events support
      } else if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        Door({
          spawnPos: { x: pos.x, y: pos.y },
          length: 4,
          name: userData?.doorName,
          sound: ASSETS.sounds_Chest_Open_Creak_3_1,
        });
      } else if (tag === 'brick') {
        const powerUp = userData?.powerup as BrickPowerUps | undefined;
        Brick({
          bodyId,
          powerUp,
          debrisEmitter: particles.brickDebris.emitter,
        });
      } else {
        nonStandardBodies.push({ bodyId, tag, userData });
      }
    });
  });

  return {
    /** Joint from the RUBE scene — pass to `BreakoutPaddle` to create the paddle. */
    paddleJoint: paddleJoint as b2JointId,
    bodies: nonStandardBodies,
    particles,
  };
});
