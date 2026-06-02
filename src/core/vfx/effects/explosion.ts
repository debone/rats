/**
 * Explosion burst: fire ball spray.
 * In-game: vfx.play(explosionBurst, { x, y })
 */
import { Assets } from 'pixi.js';
import { defineBurst } from '../types';

export interface ExplosionParams {
  x: number;
  y: number;
}

export const explosionBurst = defineBurst<ExplosionParams>({
  kind: 'burst',
  id: 'explosionBurst',
  emitter: () => ({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 150,
    emitting: false,
    lifespan: { min: 300, max: 800 },
    speed: { min: 40, max: 220 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.15, max: 0.5 }, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: { start: 0xffff88, end: 0xff4400 },
    gravityY: 200,
    rotate: { min: -200, max: 200 },
  }),
  play({ x, y }, { emitter }) {
    emitter.explode(60, x, y);
  },
});
