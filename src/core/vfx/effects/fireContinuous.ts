/**
 * Looping fire: flames layer — attach to a position.
 * In-game: vfx.attach(fireContinuous, host, {})
 *
 * The flames emitter is the primary layer. Embers and smoke are secondary
 * layers added inline in the demo (or game scope) that call attach separately.
 */
import { Assets } from 'pixi.js';
import { defineContinuous } from '../types';

export const fireContinuous = defineContinuous({
  kind: 'continuous',
  id: 'fireContinuous',
  emitter: () => ({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 200,
    frequency: 25,
    quantity: 5,
    emitting: true,
    lifespan: { min: 500, max: 900 },
    speedY: { min: -80, max: -160 },
    speedX: { min: -20, max: 20 },
    x: { min: -30, max: 30 },
    scale: { start: { min: 0.5, max: 0.9 }, end: 0.05 },
    alpha: { start: 1, end: 0 },
    tint: { start: 0xffee22, end: 0xcc1100 },
    rotate: { min: -40, max: 40 },
  }),
  attach(_host, _params, { emitter, position }) {
    if (emitter) {
      const pos = position();
      emitter.x = pos.x;
      emitter.y = pos.y;
    }
  },
});
