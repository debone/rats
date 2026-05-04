import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { assert } from '@/core/common/assert';
import { getEntitiesOf } from '@/core/entity/entity';
import { defineEntity, type AttachHandle } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { activateCrewAbility } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import type { EntityBase } from '@/entities/entity-kinds';
import { useChildren } from '@/hooks/hooks';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import {
  b2Body_GetPosition,
  b2Body_GetUserData,
  b2Body_IsValid,
  type b2BodyId,
  type b2JointId,
} from 'phaser-box2d';
import { Assets } from 'pixi.js';

import { attachPaddleBallSnap } from '../attachments/paddleBallSnap';
import { BrickDebrisParticles } from './BrickDebrisParticles';
import { KeyListener } from './KeyListener';
import { NormBall } from './NormBall';
import { Paddle } from './Paddle';
import { PlusCheeseParticles } from './PlusCheeseParticles';
import { PlusClayParticles } from './PlusClayParticles';
import { Wall, wallSparkOnBall } from './Wall';
import { WallParticles } from './WallParticles';
import { WaterParticles } from './WaterParticles';

export interface LevelParticles {
  brickDebris: ReturnType<typeof BrickDebrisParticles>['emitter'];
  water: ReturnType<typeof WaterParticles>['emitter'];
  wall: ReturnType<typeof WallParticles>['emitter'];
  plusCheese: ReturnType<typeof PlusCheeseParticles>['emitter'];
  plusClay: ReturnType<typeof PlusClayParticles>['emitter'];
}

export interface BodyEntry {
  bodyId: b2BodyId;
  tag: string | undefined;
  userData: { type: string; powerup?: BrickPowerUps; doorName?: string } | null;
}

export interface BreakoutPhysicsProps {
  levelId: string;
  rubeAsset: string;
}

export interface BreakoutPhysicsEntity extends EntityBase {
  bodies: BodyEntry[];
  particles: LevelParticles;
  createBall(): void;
}

export const BreakoutPhysics = defineEntity((props: BreakoutPhysicsProps): BreakoutPhysicsEntity => {
  const { withChildren } = useChildren();
  const ctx = getGameContext();

  const { loadedBodies, loadedJoints } = loadSceneIntoWorld(
    Assets.get(props.rubeAsset),
    ctx.worldId!,
  );

  const particles: LevelParticles = withChildren(() => ({
    brickDebris: BrickDebrisParticles().emitter,
    water: WaterParticles().emitter,
    wall: WallParticles().emitter,
    plusCheese: PlusCheeseParticles().emitter,
    plusClay: PlusClayParticles().emitter,
  }));

  withChildren(() => {
    KeyListener({ key: 'KeyQ', onPress: () => activateCrewAbility(0) });
    KeyListener({ key: 'KeyW', onPress: () => activateCrewAbility(1) });
  });

  const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
  assert(paddleJoint, `${props.levelId}: paddle-joint not found in RUBE`);

  withChildren(() => {
    Paddle({
      jointId: paddleJoint,
      brickDebrisEmitter: particles.brickDebris,
      plusClayEmitter: particles.plusClay,
      plusCheeseEmitter: particles.plusCheese,
    });
  });

  let ballSnap: AttachHandle<{ launch: () => void; jointId: b2JointId }> | undefined;

  function createBall(): void {
    withChildren(() => {
      const paddle = getEntitiesOf(Paddle)[0];
      assert(paddle, `${props.levelId} createBall: no paddle entity`);
      const paddlePosition = b2Body_GetPosition(paddle.bodyId);
      const normBall = NormBall({ x: paddlePosition.x, y: paddlePosition.y + 1 });
      ballSnap?.detach();
      ballSnap = attachPaddleBallSnap(paddle, normBall);
    });
  }

  const nonStandardBodies: BodyEntry[] = [];

  withChildren(() => {
    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;

      const userData = b2Body_GetUserData(bodyId) as {
        type: string;
        powerup?: BrickPowerUps;
        doorName?: string;
      } | null;
      const tag = userData?.type;

      if (tag === 'left-wall' || tag === 'right-wall' || tag === 'top-wall') {
        Wall({ bodyId, wallCollisionTag: tag, onBall: wallSparkOnBall(tag, particles.wall) });
      } else if (tag === 'exit') {
        Wall({
          bodyId,
          wallCollisionTag: 'exit',
          onBall: async () => {
            ctx.events.emit(GameEvent.BALL_EXITED);
          },
        });
      } else if (tag === 'bottom-wall') {
        Wall({
          bodyId,
          wallCollisionTag: 'bottom-wall',
          onCheese: async ({ cheeseBody }) => {
            const { x, y } = BodyToScreen(cheeseBody.bodyId);
            particles.water.explode(25, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            cheeseBody.destroy();
          },
          onBall: async ({ ballBody }) => {
            const { x, y } = BodyToScreen(ballBody.bodyId);
            particles.water.explode(100, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Large_4_2, { volume: 0.25 });
            ballBody.destroy();
            if (getEntitiesOf(NormBall).length === 0) {
              ctx.events.emit(GameEvent.BALL_LOST);
            }
          },
          onScrap: async ({ scrapBody }) => {
            const { x, y } = BodyToScreen(scrapBody.bodyId);
            particles.water.explode(10, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            scrapBody.destroy();
          },
        });
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
