/**
 * PARTICLE: Rain (drops + ground splash)  [continuous]
 *
 * Wide X spread from top of screen, gravity-driven drop, splash near floor.
 * VFX type: defineContinuous — weather runs perpetually for a level/zone.
 */
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { Assets, Container } from 'pixi.js';
import { rainContinuous } from '@/core/vfx/effects/rainContinuous';

export function rain(root: Container, w: number, h: number): () => void {
  const texture = Assets.get('tiles').textures.ball;

  const emitter = new ParticleEmitter({
    ...rainContinuous.emitter!(),
    x: { min: -w / 2, max: w / 2 },
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
