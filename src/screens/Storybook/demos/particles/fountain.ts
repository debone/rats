import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { Assets, Container } from 'pixi.js';

export function fountain(root: Container, w: number, h: number): () => void {
  const texture = Assets.get('tiles').textures.ball;

  const emitter = new ParticleEmitter({
    texture,
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
  });

  emitter.x = w / 2;
  emitter.y = h - 60;
  root.addChild(emitter.container);

  return () => emitter.destroy();
}
