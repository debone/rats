import { app } from '@/main';
import { Graphics } from 'pixi.js';
import { defineBurst } from '../types';

export interface ImpactSparkParams {
  x: number;
  y: number;
  color?: number;
  count?: number;
}

let _sparkTex: ReturnType<typeof app.renderer.generateTexture> | null = null;
function getSparkTexture() {
  if (!_sparkTex) {
    const g = new Graphics();
    g.circle(0, 0, 3).fill(0xffffff);
    g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.2 });
    _sparkTex = app.renderer.generateTexture(g);
    g.destroy();
  }
  return _sparkTex;
}

export const impactSpark = defineBurst<ImpactSparkParams>({
  kind: 'burst',
  id: 'impactSpark',
  priority: 'normal',
  emitter: () => ({
    texture: getSparkTexture(),
    maxParticles: 30,
    lifespan: { min: 350, max: 550 },
    speed: { min: 60, max: 240 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.4, max: 1.0 }, end: 0 },
    alpha: { start: 1, end: 0 },
    gravityY: 280,
  }),
  play({ x, y, color = 0xffcc44, count = 22 }, { emitter }) {
    emitter.container.tint = color;
    emitter.explode(count, x, y);
  },
});
