import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { Assets, Container } from 'pixi.js';

export function fire(root: Container, w: number, h: number): () => void {
  const texture = Assets.get('tiles').textures.ball;

  const flames = new ParticleEmitter({
    texture,
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
  });

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
