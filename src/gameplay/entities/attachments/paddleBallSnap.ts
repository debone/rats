import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { attach, onCleanup } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import type { PaddleEntity } from '@/gameplay/entities/Paddle';
import { useImmediateUpdate } from '@/hooks/hooks';
import { ScheduleSystem } from '@/systems/app/ScheduleSystem';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition, b2Body_SetLinearVelocity, b2Vec2, CreatePrismaticJoint } from 'phaser-box2d';
import { InputDevice } from 'pixijs-input-devices';
import type { NormBallEntity } from '../NormBall';

export const SNAP_LAUNCH_COOLDOWN_MS = 20;

/**
 * Prismatic joint between paddle and ball + `launch()` (joint break + initial velocity).
 * Level-0 only; lives on the paddle scope via `attach`.
 *
 * @param options.onLaunch - Called synchronously the moment the player triggers a launch,
 *   before the joint is queued for destruction. Use this to set a cooldown in the caller
 *   so that the contact event that fires while the ball is still sitting on the paddle
 *   (before its velocity kicks in) does not trigger an immediate re-snap.
 */
export function attachPaddleBallSnap(paddle: PaddleEntity, ball: NormBallEntity, options?: { onLaunch?: () => void }) {
  return attach(paddle, () => {
    const worldId = getGameContext().worldId!;
    const physics = getGameContext().systems.get(PhysicsSystem);
    const schedule = getGameContext().systems.get(ScheduleSystem);

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
    let cancelVelocityTask: (() => void) | undefined;

    onCleanup(() => {
      if (jointAlive) {
        physics.queueJointDestruction(jointId);
      }
      // Cancel a pending velocity task if the snap is detached before it fires
      // (e.g. paddle swapped while the ball is in its launch window).
      cancelVelocityTask?.();
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
        // Notify the caller before the joint is destroyed so it can open the
        // re-snap cooldown window before the next physics step runs.
        options?.onLaunch?.();
        physics.queueJointDestruction(jointId);

        ball.startUpdating();

        const ballPos = b2Body_GetPosition(ball.bodyId);
        const paddlePos = b2Body_GetPosition(paddle.bodyId);
        sfx.play(ASSETS.sounds_Rat_Squeak_A);

        const x = ballPos.x - paddlePos.x;
        const y = ballPos.y - paddlePos.y;

        // Set velocity after the same window as the re-snap cooldown. This
        // ensures the ball is not treated as a new paddle arrival while it is
        // still motionless on the paddle surface.
        cancelVelocityTask = schedule.schedule(() => {
          cancelVelocityTask = undefined;
          b2Body_SetLinearVelocity(ball.bodyId, new b2Vec2(x, y));
        }, SNAP_LAUNCH_COOLDOWN_MS);
      },
    };

    return snap;
  });
}
