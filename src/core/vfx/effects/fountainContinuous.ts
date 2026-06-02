/**
 * Upward fountain arc with gravity.
 * In-game: vfx.attach(fountainContinuous, host, {})
 */
import { Assets } from 'pixi.js';
import { defineContinuous } from '../types';

export const fountainContinuous = defineContinuous({
  kind: 'continuous',
  id: 'fountainContinuous',
  emitter: () => ({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 200,
    frequency: 20,
    quantity: 3,
    emitting: true,
    lifespan: { min: 900, max: 1400 },
    speed: { min: 80, max: 160 },
    angle: { min: -100, max: -80 },
    accelerationY: 280,
    x: { min: -6, max: 6 },
    scale: { start: { min: 0.2, max: 0.4 }, end: 0.05 },
    alpha: { start: 1, end: 0 },
    tint: { start: 0x88ffff, end: 0x0033bb },
    rotate: { min: -60, max: 60 },
  }),
  attach(_host, _params, { emitter, position }) {
    if (emitter) {
      const pos = position();
      emitter.x = pos.x;
      emitter.y = pos.y;
    }
  },
});
