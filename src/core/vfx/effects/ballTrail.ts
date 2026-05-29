import { ASSETS } from '@/assets';
import type { EntityBase } from '@/core/entity/scope';
import { useImmediateUpdate } from '@/hooks/hooks';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import type { b2BodyId } from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { defineContinuous } from '../types';

/** Structural shape required from the host — satisfied by NormBallEntity and any similar ball entity. */
interface BallLike extends EntityBase {
  bodyId: b2BodyId;
  /** True while the ball is in motion; trail is suppressed when false. */
  active: boolean;
}

/**
 * Continuous trail behind a moving ball. Attach after the ball entity is created:
 *
 *   const ball = NormBall({ x, y });
 *   vfx.attach(ballTrail, ball, undefined);
 *
 * The emitter is retained for the attachment's lifetime and released automatically
 * when the ball entity is destroyed.
 */
export const ballTrail = defineContinuous<void, BallLike>({
  kind: 'continuous',
  id: 'ballTrail',
  priority: 'ambient',
  emitter: () => {
    const { textures } = Assets.get(ASSETS.tiles);
    return {
      texture: textures['ball'],
      maxParticles: 32,
      lifespan: { min: 60, max: 120 },
      speed: { min: 0, max: 6 },
      angle: { min: 0, max: 360 },
      scale: { start: { min: 0.35, max: 0.55 }, end: 0 },
      alpha: { start: 0.5, end: 0 },
    };
  },
  attach(ball, _params, { emitter }) {
    useImmediateUpdate(() => {
      if (!emitter || !ball.active) return;
      const { x, y } = BodyToScreen(ball.bodyId);
      emitter.explode(1, x, y);
    });
  },
});
