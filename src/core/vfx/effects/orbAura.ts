import { app } from '@/main';
import { Graphics } from 'pixi.js';
import { defineContinuous } from '../types';

let _starTex: ReturnType<typeof app.renderer.generateTexture> | null = null;
export function getOrbStarTexture() {
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

let _puffTex: ReturnType<typeof app.renderer.generateTexture> | null = null;
export function getOrbPuffTexture() {
  if (!_puffTex) {
    const g = new Graphics();
    g.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.06 });
    g.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.12 });
    g.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.28 });
    g.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.55 });
    g.circle(0, 0, 2).fill({ color: 0xffffff, alpha: 0.9 });
    _puffTex = app.renderer.generateTexture(g);
    g.destroy();
  }
  return _puffTex;
}

/**
 * Magical orb particle aura — composite star + soft-puff trail.
 * Attach to a moving entity to give it a magic trail crown.
 *
 * The emitter config defines the star layer. The soft puff layer is secondary
 * and created by the caller (see storybook magicTrail demo for the full pattern).
 *
 * In-game usage:
 *   vfx.attach(orbAura, entity, undefined, followPoint(entityPos));
 */
export const orbAura = defineContinuous<void>({
  kind: 'continuous',
  id: 'orbAura',
  priority: 'ambient',
  emitter: () => ({
    texture: getOrbStarTexture(),
    maxParticles: 80,
    emitting: true,
    frequency: 25,
    quantity: 1,
    lifespan: { min: 300, max: 600 },
    speed: { min: 5, max: 35 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.2, max: 0.55 }, end: 0 },
    tint: { start: 0xffeebb, end: 0x8833ff },
    alpha: { start: 0.9, end: 0 },
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
