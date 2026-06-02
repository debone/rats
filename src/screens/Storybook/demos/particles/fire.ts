/**
 * PARTICLE: Fire (flames + embers + smoke)  [continuous]
 *
 * Three layered emitters: fast hot flames, slow rising embers, expanding smoke.
 * VFX type: defineContinuous — fire is alive for as long as the host entity is.
 * Position updates are done manually here (no game entity scope in storybook).
 */
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { Assets, Container } from 'pixi.js';
import { fireContinuous } from '@/core/vfx/effects/fireContinuous';

export function fire(root: Container, w: number, h: number): () => void {
  const texture = Assets.get('tiles').textures.ball;

  const flames = new ParticleEmitter(fireContinuous.emitter!());
  flames.x = w / 2;
  flames.y = h - 40;
  root.addChild(flames.container);

  // Embers rise higher, slower
  const embers = new ParticleEmitter({
    texture,
    maxParticles: 60,
    frequency: 80,
    quantity: 1,
    emitting: true,
    lifespan: { min: 1200, max: 2000 },
    speedY: { min: -20, max: -60 },
    speedX: { min: -15, max: 15 },
    x: { min: -25, max: 25 },
    scale: { start: { min: 0.07, max: 0.14 }, end: 0 },
    alpha: { start: 0.9, end: 0 },
    tint: { start: 0xff8800, end: 0x330000 },
  });
  embers.x = w / 2;
  embers.y = h - 45;
  root.addChild(embers.container);

  // Smoke
  const smoke = new ParticleEmitter({
    texture,
    maxParticles: 60,
    frequency: 120,
    quantity: 1,
    emitting: true,
    lifespan: { min: 1500, max: 2500 },
    speedY: { min: -30, max: -80 },
    speedX: { min: -30, max: 30 },
    x: { min: -20, max: 20 },
    scale: { start: { min: 0.4, max: 0.8 }, end: 2.0 },
    alpha: { start: 0.25, end: 0 },
    tint: 0x444444,
  });
  smoke.x = w / 2;
  smoke.y = h - 80;
  root.addChild(smoke.container);

  return () => {
    flames.destroy();
    embers.destroy();
    smoke.destroy();
  };
}
