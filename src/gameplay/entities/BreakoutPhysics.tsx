import { ASSETS } from '@/assets';
import { assert } from '@/core/common/assert';
import { defineEntity, getEntitiesOf, type AttachHandle } from '@/core/entity/scope';
import { sfx } from '@/core/audio/audio';
import { getGameContext } from '@/data/game-context';
import { GameEvent } from '@/data/events';
import { activateCrewAbility } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { useChildren } from '@/hooks/hooks';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid, type b2BodyId, type b2JointId } from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { KeyListener } from '../../systems/keyboard/KeyListener';
import { Brick } from './Brick';
import { Door } from './Door';
import { NormBall } from './NormBall';
import { Paddle } from './Paddle';
import { StrongBrick } from './StrongBrick';
import { Wall, wallSparkOnBall } from './Wall';
import { attachPaddleBallSnap } from './attachments/paddleBallSnap';
import { BrickDebrisParticles } from './particles/BrickDebrisParticles';
import { PlusCheeseParticles } from './particles/PlusCheeseParticles';
import { PlusClayParticles } from './particles/PlusClayParticles';
import { WallParticles } from './particles/WallParticles';
import { WaterParticles } from './particles/WaterParticles';

export interface BodyUserData {
  type: string;
  powerup?: BrickPowerUps;
  doorName?: string;
  doorLength?: number;
  doorOpeningDirection?: 'left' | 'right';
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
    water: WaterParticles(),
    plusClay: PlusClayParticles(),
    plusCheese: PlusCheeseParticles(),
  }));

  withChildren(() => {
    KeyListener({
      key: 'KeyQ',
      onPress: () => activateCrewAbility(0),
    });
    KeyListener({
      key: 'KeyW',
      onPress: () => activateCrewAbility(1),
    });
  });

  const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
  assert(paddleJoint, `${levelId}: paddle-joint not found in RUBE`);

  withChildren(() =>
    Paddle({
      jointId: paddleJoint,
      brickDebrisEmitter: particles.brickDebris.emitter,
      plusClayEmitter: particles.plusClay.emitter,
      plusCheeseEmitter: particles.plusCheese.emitter,
    }),
  );

  let ballSnap: AttachHandle<{ launch: () => void; jointId: b2JointId }> | undefined = undefined;

  const createBall = () => {
    withChildren(() => {
      const paddle = getEntitiesOf(Paddle)[0];
      assert(paddle, `${levelId}: paddle not found`);
      const paddlePosition = b2Body_GetPosition(paddle.bodyId);

      const ball = NormBall({ x: paddlePosition.x, y: paddlePosition.y + 1 });
      ballSnap?.detach();
      ballSnap = attachPaddleBallSnap(paddle, ball);
    });
  };

  const nonStandardBodies: BodyEntry[] = [];

  withChildren(() => {
    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;

      const userData = b2Body_GetUserData(bodyId) as BodyUserData | null;
      const tag = userData?.type;

      if (tag === 'left-wall' || tag === 'right-wall' || tag === 'top-wall') {
        Wall({ bodyId, wallCollisionTag: tag, onBall: wallSparkOnBall(tag, particles.wall.emitter) });
      } else if (tag === 'exit') {
        Wall({
          bodyId,
          wallCollisionTag: 'exit',
          onBall: () => {
            ctx.events.emit(GameEvent.BALL_EXITED);
          },
        });
      } else if (tag === 'bottom-wall') {
        Wall({
          bodyId,
          wallCollisionTag: 'bottom-wall',
          onBall: ({ ballBody }) => {
            const { x, y } = BodyToScreen(ballBody.bodyId);
            particles.water.emitter.explode(100, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Large_4_2, { volume: 0.25 });
            ballBody.destroy();
            ctx.events.emit(GameEvent.BALL_LOST);
          },
          onCheese: ({ cheeseBody }) => {
            const { x, y } = BodyToScreen(cheeseBody.bodyId);
            particles.water.emitter.explode(25, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            cheeseBody.destroy();
          },
          onScrap: ({ scrapBody }) => {
            const { x, y } = BodyToScreen(scrapBody.bodyId);
            particles.water.emitter.explode(10, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            scrapBody.destroy();
          },
        });
      } else if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        Door({
          spawnPos: { x: pos.x, y: pos.y },
          length: userData?.doorLength ?? 4,
          name: userData?.doorName,
          openingDirection: userData?.doorOpeningDirection,
          sound: ASSETS.sounds_Chest_Open_Creak_3_1,
        });
      } else if (tag === 'brick') {
        const powerUp = userData?.powerup;
        Brick({ bodyId, powerUp, debrisEmitter: particles.brickDebris.emitter });
      } else if (tag === 'strong-brick') {
        StrongBrick({ bodyId, debrisEmitter: particles.brickDebris.emitter });
      } else {
        nonStandardBodies.push({ bodyId, tag, userData });
      }
    });
  });

  createBall();

  return {
    bodies: nonStandardBodies,
    particles,
    createBall,
  };
});
