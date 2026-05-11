import { assert } from '@/core/common/assert';
import { defineEntity, type AttachHandle } from '@/core/entity/scope';
import { useChildren } from '@/hooks/hooks';
import { b2Body_GetPosition, type b2JointId } from 'phaser-box2d';
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
    withChildren(() => {
      const pos = b2Body_GetPosition(paddle!.bodyId);
      const ball = NormBall({ x: pos.x, y: pos.y + 1 });
      ballSnap?.detach();
      ballSnap = attachPaddleBallSnap(paddle!, ball);
    });
  };

  return { createBall };
});
