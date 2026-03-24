import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { attach, onCleanup } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { useImmediateUpdate } from '@/hooks/hooks';
import type { PaddleEntity } from '@/systems/level/levels/entities/Paddle';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition, b2Body_SetLinearVelocity, b2Vec2, CreatePrismaticJoint } from 'phaser-box2d';
import { InputDevice } from 'pixijs-input-devices';
import type { NormBallEntity } from '../entities/NormBall';

/**
 * Prismatic joint between paddle and ball + `launch()` (joint break + initial velocity).
 * Level-0 only; lives on the paddle scope via `attach`.
 */
export function attachPaddleBallSnap(paddle: PaddleEntity, ball: NormBallEntity) {
  return attach(paddle, () => {
    const worldId = getGameContext().worldId!;
    const physics = getGameContext().systems.get(PhysicsSystem);

    const { jointId } = CreatePrismaticJoint({
      worldId,
      bodyIdA: paddle.bodyId,
      bodyIdB: ball.bodyId,
      anchorA: new b2Vec2(0, 0.7),
      anchorB: new b2Vec2(0, 0),
      axis: new b2Vec2(1, 0),
      enableLimit: true,
      lowerTranslation: 0,
      upperTranslation: 0,
    });

    let jointAlive = true;
    onCleanup(() => {
      if (jointAlive) {
        physics.queueJointDestruction(jointId);
      }
    });

    const { stop } = useImmediateUpdate(() => {
      if (InputDevice.gamepads[0]?.button.Face1 || InputDevice.keyboard.key.Space) {
        snap.launch();
        stop();
      }
    });

    const snap = {
      jointId,
      launch() {
        if (!jointAlive) return;
        jointAlive = false;
        physics.queueJointDestruction(jointId);

        ball.startUpdating();

        const ballPos = b2Body_GetPosition(ball.bodyId);
        const paddlePos = b2Body_GetPosition(paddle.bodyId);
        sfx.play(ASSETS.sounds_Rat_Squeak_A);

        const x = ballPos.x - paddlePos.x;
        const y = ballPos.y - paddlePos.y;
        setTimeout(() => {
          b2Body_SetLinearVelocity(ball.bodyId, new b2Vec2(x, y));
        }, 20);
      },
    };

    return snap;
  });
}
