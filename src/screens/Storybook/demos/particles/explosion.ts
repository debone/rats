import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { app } from '@/main';
import { Assets, Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

export function explosion(root: Container, w: number, h: number): () => void {
  const textureBall = Assets.get('tiles').textures.ball;
  const textureScrap = Assets.get('prototype').textures['scraps#0'];

  const burst = new ParticleEmitter({
    texture: textureBall,
    maxParticles: 150,
    emitting: false,
    lifespan: { min: 300, max: 800 },
    speed: { min: 40, max: 220 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.15, max: 0.5 }, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: { start: 0xffff88, end: 0xff4400 },
    gravityY: 200,
    rotate: { min: -200, max: 200 },
  });
  root.addChild(burst.container);

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

  let flashAlpha = 0;

  const trigger = (x: number, y: number) => {
    burst.x = x;
    burst.y = y;
    debris.x = x;
    debris.y = y;
    flash.x = x;
    flash.y = y;
    flashAlpha = 1;
    burst.explode(60);
    debris.explode(40);
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
    burst.destroy();
    debris.destroy();
    flash.destroy();
    hint.destroy();
    overlay.destroy();
  };
}
