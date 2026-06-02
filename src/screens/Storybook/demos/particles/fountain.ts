/**
 * PARTICLE: Water Fountain  [continuous]
 *
 * Upward arc with gravity (accelerationY), narrow spread angle (-100..−80°).
 * VFX type: defineContinuous — fountain runs continuously while attached.
 */
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { Container } from 'pixi.js';
import { fountainContinuous } from '@/core/vfx/effects/fountainContinuous';

export function fountain(root: Container, w: number, h: number): () => void {
  const emitter = new ParticleEmitter(fountainContinuous.emitter!());
  emitter.x = w / 2;
  emitter.y = h - 60;
  root.addChild(emitter.container);

  return () => emitter.destroy();
}
