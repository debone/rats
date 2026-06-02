import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { Graphics } from 'pixi.js';
import { defineBurst } from '../types';

export interface StarCollectParams {
  x: number;
  y: number;
}

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

let _sparkTex: ReturnType<typeof app.renderer.generateTexture> | null = null;
function getSparkTexture() {
  if (!_sparkTex) {
    const g = new Graphics();
    g.rect(-1, -7, 2, 14).fill(0xffffff);
    g.rect(-0.5, -7, 1, 14).fill({ color: 0xffffff, alpha: 0.5 });
    _sparkTex = app.renderer.generateTexture(g);
    g.destroy();
  }
  return _sparkTex;
}

/**
 * One-shot collect burst: radiating stars + spark ring.
 * Represents a collectible item being picked up (coin, powerup, achievement).
 *
 * In-game usage:
 *   vfx.play(starCollect, { x, y });
 */
export const starCollect = defineBurst<StarCollectParams>({
  kind: 'burst',
  id: 'starCollect',
  priority: 'normal',
  cooldownMs: 50,
  emitter: () => ({
    texture: getStarTexture(),
    maxParticles: 80,
    lifespan: { min: 400, max: 700 },
    speed: { min: 60, max: 200 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.35, max: 0.8 }, end: 0 },
    tint: { start: 0xffee44, end: 0xff8833 },
    alpha: { start: 1, end: 0 },
    rotation: { min: 0, max: 360 },
  }),
  play({ x, y }, { emitter, layer }) {
    emitter.explode(28, x, y);

    // Spark ring — secondary emitter spawned inline for the burst
    const sparkEmitter = new ParticleEmitter({
      texture: getSparkTexture(),
      maxParticles: 30,
      lifespan: { min: 200, max: 400 },
      speed: { min: 100, max: 260 },
      angle: { min: 0, max: 360 },
      scale: { start: { min: 0.2, max: 0.45 }, end: 0 },
      tint: { start: 0xffffff, end: 0xffcc44 },
      alpha: { start: 0.9, end: 0 },
    });
    layer.addChild(sparkEmitter.container);
    sparkEmitter.explode(14, x, y);
    setTimeout(() => sparkEmitter.destroy(), 600);
  },
});
