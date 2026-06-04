import { ASSETS } from '@/assets';
import type { EntityBase } from '@/core/entity/scope';
import { useImmediateUpdate } from '@/hooks/hooks';
import { Assets } from 'pixi.js';
import { defineContinuous } from '@/systems/vfx/types';

/**
 * Structural shape required from the host. The trail no longer reads a physics
 * body itself — it asks `ctx.position` where to emit, so the host only needs to
 * say whether the trail should currently run.
 */
interface TrailHost extends EntityBase {
  /** True while in motion; the trail is suppressed when false. */
  active: boolean;
}

/**
 * Continuous trail behind a moving target. Attach after the host is created,
 * passing a position source for whatever it follows:
 *
 *   const ball = NormBall({ x, y });
 *   vfx.attach(ballTrail, ball, undefined, followBody(ball.bodyId));
 *
 * The emitter is retained for the attachment's lifetime and released automatically
 * when the host entity is destroyed.
 */
export const ballTrail = defineContinuous<void, TrailHost>({
  kind: 'continuous',
  id: 'ballTrail',
  priority: 'ambient',
  emitter: () => {
    const { textures } = Assets.get(ASSETS.tiles);
    return {
      texture: textures['ball'],
      maxParticles: 32,
      lifespan: { min: 60, max: 120 },
      speed: { min: 0, max: 60 },
      angle: { min: 0, max: 360 },
      scale: { start: { min: 0.35, max: 0.55 }, end: 0 },
      alpha: { start: 0.5, end: 0 },
    };
  },
  attach(host, _params, { emitter, position }) {
    useImmediateUpdate(() => {
      if (!emitter || !host.active) return;
      const { x, y } = position();
      emitter.explode(1, x, y);
    });
  },
});
