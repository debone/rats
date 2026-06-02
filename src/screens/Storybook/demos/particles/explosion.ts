/**
 * PARTICLE: Explosion Burst  [burst]
 *
 * Fire spray: defineBurst with fire ball emitter.
 * Debris shrapnel: secondary inline emitter for scraps.
 *
 * VFX type: defineBurst — click triggers an explode() on the pooled emitter.
 * Multiple clicks coalesce into the same emitter pool.
 */
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { app } from '@/main';
import { Assets, Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';
import { explosionBurst } from '@/core/vfx/effects/explosion';
import type { BurstContext } from '@/core/vfx/types';

export function explosion(root: Container, w: number, h: number): () => void {
  const textureScrap = Assets.get(ASSETS.prototype).textures['scraps#0'];

  const burstEmitter = new ParticleEmitter(explosionBurst.emitter());
  root.addChild(burstEmitter.container);

  const debris = new ParticleEmitter({
    texture: textureScrap,
    maxParticles: 80,
    emitting: false,
    lifespan: { min: 400, max: 700 },
    speed: { min: 60, max: 200 },
    angle: { min: 0, max: 360 },
    gravityY: 350,
    scale: { start: { min: 0.3, max: 0.7 }, end: 0.0 },
    rotate: { min: -300, max: 300 },
    tint: { start: 0xff8800, end: 0x330000 },
  });
  root.addChild(debris.container);

  const flash = new Graphics();
  flash.circle(0, 0, 50).fill({ color: 0xffcc44, alpha: 0.8 });
  flash.alpha = 0;
  root.addChild(flash);

  const hint = new Text({
    text: 'CLICK TO EXPLODE',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0x9944bb },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 30;
  root.addChild(hint);

  const burstCtx: BurstContext = { emitter: burstEmitter, camera: null as any, layer: root };
  let flashAlpha = 0;

  const trigger = (x: number, y: number) => {
    debris.x = x;
    debris.y = y;
    debris.explode(40);
    flash.x = x;
    flash.y = y;
    flashAlpha = 1;
    explosionBurst.play({ x, y }, burstCtx);
  };

  // First explosion at center
  trigger(w / 2, h / 2);

  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0 });
  overlay.interactive = true;
  overlay.on('pointertap', (e) => {
    const local = root.toLocal(e.global);
    trigger(local.x, local.y);
  });
  root.addChild(overlay);

  const tick = (time: { deltaMS: number }) => {
    flashAlpha = Math.max(0, flashAlpha - time.deltaMS / 80);
    flash.alpha = flashAlpha;
  };
  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    burstEmitter.destroy();
    debris.destroy();
    flash.destroy();
    hint.destroy();
    overlay.destroy();
  };
}
