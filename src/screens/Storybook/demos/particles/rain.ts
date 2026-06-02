import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { Assets, Container } from 'pixi.js';

export function rain(root: Container, w: number, h: number): () => void {
  const texture = Assets.get('tiles').textures.ball;

  const emitter = new ParticleEmitter({
    texture,
    maxParticles: 300,
    frequency: 30,
    quantity: 4,
    emitting: true,
    lifespan: { min: 1800, max: 2400 },
    speedX: { min: 20, max: 40 },
    speedY: { min: 180, max: 260 },
    x: { min: -w / 2, max: w / 2 },
    scale: { min: 0.06, max: 0.15 },
    alpha: { start: 0.7, end: 0.2 },
    tint: 0x88aaff,
  });

  emitter.x = w / 2;
  emitter.y = -10;
  root.addChild(emitter.container);

  // Splash particles near bottom
  const splash = new ParticleEmitter({
    texture,
    maxParticles: 80,
    frequency: 80,
    quantity: 2,
    emitting: true,
    lifespan: { min: 200, max: 400 },
    speed: { min: 20, max: 60 },
    angle: { min: -150, max: -30 },
    x: { min: -w / 2, max: w / 2 },
    scale: { min: 0.05, max: 0.12 },
    alpha: { start: 0.6, end: 0 },
    tint: 0xaaccff,
  });

  splash.x = w / 2;
  splash.y = h - 20;
  root.addChild(splash.container);

  return () => {
    emitter.destroy();
    splash.destroy();
  };
}
