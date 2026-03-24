import { attach, onCleanup } from '@/core/entity/scope';
import { useUpdate } from '@/hooks/hooks';
import type { PaddleEntity } from '@/systems/level/levels/entities/Paddle';

/**
 * Captain powerup: faster paddle + tint (level-0 rewrite path).
 * Wire `GameEvent.POWERUP_CAPTAIN` to `attachCaptainBoost(paddle)`; `detach()` previous first to restack.
 */
export function attachCaptainBoost(paddle: PaddleEntity) {
  return attach(paddle, (paddle) => {
    let timeoutSpeedBoat = 15000;
    paddle.maxSpeed = 23;
    paddle.sprite.tint = 0xffff00;

    function slowBoat() {
      timeoutSpeedBoat = 1000;
      paddle.maxSpeed = 15;
      paddle.sprite.tint = 0xffffff;
    }

    const { start, stop } = useUpdate((delta) => {
      if (timeoutSpeedBoat > 0) {
        timeoutSpeedBoat -= delta;
        if (timeoutSpeedBoat <= 0) {
          slowBoat();
        }
      }
    });
    start();

    onCleanup(() => {
      stop();
      paddle.maxSpeed = 15;
      paddle.sprite.tint = 0xffffff;
    });

    return {};
  });
}
