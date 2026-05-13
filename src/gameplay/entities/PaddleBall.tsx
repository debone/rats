import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { assert } from '@/core/common/assert';
import { attach, defineEntity, type AttachHandle } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { useChildren, useGameEvent } from '@/hooks/hooks';
import { b2Body_GetPosition, b2Body_SetLinearVelocity, b2Vec2, type b2JointId } from 'phaser-box2d';
import { NormBall } from './NormBall';
import { Paddle, type PaddleEntity } from './Paddle';
import { attachPaddleBallSnap } from './attachments/paddleBallSnap';

export interface PaddleBallProps {
  levelId: string;
  paddleJoint: b2JointId;
}

export const PaddleAndBall = defineEntity(({ levelId, paddleJoint }: PaddleBallProps) => {
  const { withChildren } = useChildren();

  let paddle: PaddleEntity | undefined;
  withChildren(() => {
    paddle = Paddle({ jointId: paddleJoint });
  });

  let ballSnap: AttachHandle<{ launch: () => void; jointId: b2JointId }> | undefined;

  const createBall = () => {
    assert(paddle, `${levelId}: paddle not found`);
    attach(paddle, (p) => {
      withChildren(() => {
        const pos = b2Body_GetPosition(p.bodyId);
        const ball = NormBall({ x: pos.x, y: pos.y + 1 });
        ballSnap?.detach();
        ballSnap = attachPaddleBallSnap(p, ball);
      });
    });
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

  return { createBall };
});
