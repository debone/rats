import { app } from '@/main';
import { Graphics } from 'pixi.js';
import { defineContinuous } from '../types';

let _starTex: ReturnType<typeof app.renderer.generateTexture> | null = null;
function getStarTexture() {
  if (!_starTex) {
    const g = new Graphics();
    const R = 7, r = 3;
    const pts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const outerA = (i * 72 - 90) * Math.PI / 180;
      const innerA = outerA + 36 * Math.PI / 180;
      pts.push(Math.cos(outerA) * R, Math.sin(outerA) * R);
      pts.push(Math.cos(innerA) * r, Math.sin(innerA) * r);
    }
    g.poly(pts).fill(0xffffff);
    _starTex = app.renderer.generateTexture(g);
    g.destroy();
  }
  return _starTex;
}

/**
 * Ambient star sparkle aura — continuous upward drift at low speed.
 * Attach to any entity to give it a "magical presence" idle glow.
 *
 * In-game usage:
 *   vfx.attach(starAura, entity, undefined, followBody(entity.bodyId));
 */
export const starAura = defineContinuous<void>({
  kind: 'continuous',
  id: 'starAura',
  priority: 'ambient',
  emitter: () => ({
    texture: getStarTexture(),
    maxParticles: 60,
    emitting: true,
    frequency: { min: 9, max: 14 },
    quantity: 1,
    lifespan: { min: 1800, max: 3200 },
    speed: { min: 6, max: 28 },
    angle: { min: 250, max: 290 },
    scale: { start: { min: 0.18, max: 0.55 }, end: 0 },
    tint: { start: 0xffeebb, end: 0x8866ff },
    alpha: { start: 0.8, end: 0 },
    rotation: { min: 0, max: 360 },
  }),
  attach(_host, _params, { emitter, position }) {
    if (!emitter) return;
    const pos = position();
    emitter.x = pos.x;
    emitter.y = pos.y;
    emitter.follow = position() as { x: number; y: number };
  },
});
