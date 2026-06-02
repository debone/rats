/**
 * Continuous rain drops.
 * In-game: vfx.attach(rainContinuous, host, {})
 *
 * The emitter config provides base rain drop properties. The x-spread and
 * screen-space positioning are applied by the caller (demo or game scope)
 * since they depend on the viewport dimensions.
 */
import { Assets } from 'pixi.js';
import { defineContinuous } from '../types';

export const rainContinuous = defineContinuous({
  kind: 'continuous',
  id: 'rainContinuous',
  emitter: () => ({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 300,
    frequency: 30,
    quantity: 4,
    emitting: true,
    lifespan: { min: 1800, max: 2400 },
    speedX: { min: 20, max: 40 },
    speedY: { min: 180, max: 260 },
    scale: { min: 0.06, max: 0.15 },
    alpha: { start: 0.7, end: 0.2 },
    tint: 0x88aaff,
  }),
  attach(_host, _params, { emitter, position }) {
    if (emitter) {
      const pos = position();
      emitter.x = pos.x;
      emitter.y = pos.y;
    }
  },
});
