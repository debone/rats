import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { assert } from '@/core/common/assert';
import { attach, defineEntity, type AttachHandle } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { useChildren, useEffect, useGameEvent } from '@/hooks/hooks';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import {
  b2Body_GetPosition,
  b2Body_SetLinearVelocity,
  b2DestroyBody,
  b2Joint_GetBodyA,
  b2Joint_GetBodyB,
  b2Joint_GetLocalAnchorA,
  b2Joint_GetLocalAnchorB,
  b2Joint_IsValid,
  b2JointId,
  b2PrismaticJoint_GetLowerLimit,
  b2PrismaticJoint_GetUpperLimit,
  b2Vec2,
} from 'phaser-box2d';
import { NormBall, type NormBallEntity } from './NormBall';
import { Paddle, type PaddleEntity, type PaddleJointConfig, type PaddleSize } from './Paddle';
import { attachPaddleBallSnap, SNAP_LAUNCH_COOLDOWN_MS } from './attachments/paddleBallSnap';

export interface PaddleBallProps {
  levelId: string;
  paddleJoint: b2JointId;
}

export const PaddleAndBall = defineEntity(({ levelId, paddleJoint }: PaddleBallProps) => {
  const { withChildren } = useChildren();
  const schedule = getGameContext().systems.get(ScheduleSystem);

  // Extract all stable joint parameters before consuming the template joint.
  // anchorBodyId is a static geometry body that lives for the entire level
  const jointConfig: PaddleJointConfig = {
    anchorBodyId: b2Joint_GetBodyA(paddleJoint),
    localAnchorA: b2Joint_GetLocalAnchorA(paddleJoint).clone(),
    localAnchorB: b2Joint_GetLocalAnchorB(paddleJoint).clone(),
    lowerLimit: b2PrismaticJoint_GetLowerLimit(paddleJoint),
    upperLimit: b2PrismaticJoint_GetUpperLimit(paddleJoint),
  };

  const tempBodyId = b2Joint_GetBodyB(paddleJoint);
  const initialSpawnPos = b2Body_GetPosition(tempBodyId).clone();
  b2DestroyBody(tempBodyId);

  let paddle: PaddleEntity | undefined;
  let ballSnap: AttachHandle<{ launch: () => void; jointId: b2JointId }> | undefined;
  let snappedBall: NormBallEntity | undefined;
  // True during the SNAP_LAUNCH_COOLDOWN_MS window after a launch. While set,
  // CREW_STICK_BALL_TO_PADDLE events are ignored so the ball is not immediately
  // re-snapped before its velocity has been applied.
  let snapOnCooldown = false;

  const snapBallToPaddle = (p: PaddleEntity, ball: NormBallEntity) => {
    ballSnap?.detach();
    ballSnap = attachPaddleBallSnap(p, ball, {
      onLaunch: () => {
        snapOnCooldown = true;
        schedule.schedule(() => {
          snapOnCooldown = false;
        }, SNAP_LAUNCH_COOLDOWN_MS);
      },
    });
    snappedBall = ball;
  };

  const swapPaddle = (size: PaddleSize) => {
    // Check before destroying — joint validity distinguishes "still snapped" from "launched".
    const ballStillSnapped = ballSnap != null && b2Joint_IsValid(ballSnap.jointId);
    const ballToResnap = ballStillSnapped ? snappedBall : undefined;

    // Spawn the new paddle where the old one currently is.
    let spawnPos;
    if (paddle) {
      spawnPos = b2Body_GetPosition(paddle!.bodyId).clone();
      paddle!.destroy(); // auto-destroys its prismatic joint and ballSnap attachment
      ballSnap = undefined;
    } else {
      spawnPos = initialSpawnPos;
    }

    paddle = Paddle({ jointConfig, spawnPos, size });

    if (ballToResnap) {
      snapBallToPaddle(paddle, ballToResnap);
    }
  };

  useGameEvent(GameEvent.CREW_STICK_BALL_TO_PADDLE, () => {
    assert(paddle, `${levelId}: paddle not found`);

    if (snapOnCooldown) return;

    const someBallSnapped = ballSnap != null && b2Joint_IsValid(ballSnap.jointId);
    if (someBallSnapped) {
      return;
    }
    snapBallToPaddle(paddle, snappedBall!);
  });

  const smallerBoatSignal = getRunState().crewBoons.mysz_smallerBoat;
  const longerBoatSignal = getRunState().crewBoons.littlemi_longerBoat;

  useEffect(() => {
    const smallerBoat = smallerBoatSignal.get();
    const longerBoat = longerBoatSignal.get();
    const size = smallerBoat ? 'small' : longerBoat ? 'large' : 'normal';

    swapPaddle(size);
  });

  // --- Ball management ---

  const createBall = () => {
    assert(paddle, `${levelId}: paddle not found`);
    const pos = b2Body_GetPosition(paddle.bodyId);
    const ball = NormBall({ x: pos.x, y: pos.y + 1 });
    snapBallToPaddle(paddle, ball);
  };

  useGameEvent(GameEvent.CREW_SHOOT_BALL, () => {
    assert(paddle, `${levelId}: paddle not found`);
    attach(paddle, (p) => {
      withChildren(() => {
        const paddlePosition = b2Body_GetPosition(p.bodyId);
        const newBall = NormBall({ x: paddlePosition.x, y: paddlePosition.y + 1 });
        newBall.startUpdating();

        const ballPos = b2Body_GetPosition(newBall.bodyId);
        const paddlePos = b2Body_GetPosition(p.bodyId);
        sfx.play(ASSETS.sounds_Rat_Squeak_A);

        const x = ballPos.x - paddlePos.x;
        const y = ballPos.y - paddlePos.y;

        queueMicrotask(() => {
          b2Body_SetLinearVelocity(newBall.bodyId, new b2Vec2(x, y));
        });
      });
    });
  });

  return { createBall, swapPaddle };
});
