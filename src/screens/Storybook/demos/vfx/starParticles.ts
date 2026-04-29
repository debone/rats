/**
 * TECHNIQUE: Sprite Particles — shape determines emotional read
 *
 * Particle shape is not cosmetic — it changes what the effect communicates:
 *   Ball/circle  → neutral, generic, placeholder
 *   Star         → magical, collectible, reward, celebration
 *   Spark (line) → electrical, high-speed, dangerous
 *   Shard        → destruction, debris, impact
 *
 * Same ParticleEmitter infrastructure, two configs side by side:
 * Left  — ambient drift: slow, upward, continuous → "idle sparkle" aura
 * Right — coin collect: periodic burst, all angles, scale decay → "reward pop"
 *
 * Swap the texture for any of the above shapes to shift the game feel.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeStarTexture, makeSparkTexture } from '../particleTextures';

export function starParticles(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let burstTimer: ReturnType<typeof setInterval> | undefined;

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060810);
  root.addChild(bg);

  // Dividing line between the two zones
  const divider = new Graphics();
  divider
    .moveTo(cx, 20)
    .lineTo(cx, h - 20)
    .stroke({ color: 0x1a1a2a, width: 1 });
  root.addChild(divider);

  const label = new Text({
    text: 'SPRITE PARTICLES — shape defines the feel',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a3a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelLeft = new Text({
    text: 'ambient sparkle\n(star, continuous drift)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x4a5a9a, letterSpacing: 1 },
  });
  labelLeft.x = 8;
  labelLeft.y = h - 28;
  root.addChild(labelLeft);

  const labelRight = new Text({
    text: 'collect burst\n(star, periodic pop)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x9a8a3a, letterSpacing: 1 },
  });
  labelRight.x = cx + 8;
  labelRight.y = h - 28;
  root.addChild(labelRight);

  // Bake textures
  const starTex  = makeStarTexture();
  const sparkTex = makeSparkTexture();

  // ─── LEFT: ambient sparkle aura ───────────────────────────────────────
  // Low-speed stars drift upward slowly, rotate gently, looping continuously
  const ambientStars = new ParticleEmitter({
    texture: starTex,
    maxParticles: 60,
    emitting: true,
    frequency: 90,
    quantity: 1,
    lifespan: { min: 1800, max: 3200 },
    speed: { min: 6, max: 28 },
    angle: { min: 250, max: 290 },          // mostly upward
    scale: { start: { min: 0.18, max: 0.55 }, end: 0 },
    tint: { start: 0xffeebb, end: 0x8866ff },
    alpha: { start: 0.8, end: 0 },
    rotation: { min: 0, max: 360 },
  });
  ambientStars.x = cx * 0.5;
  ambientStars.y = cy + 10;
  root.addChild(ambientStars.container);

  // Faint glow object at center
  const orbLeft = new Graphics();
  orbLeft.circle(cx * 0.5, cy, 10).fill({ color: 0x8866ff, alpha: 0.12 });
  orbLeft.circle(cx * 0.5, cy, 5).fill({ color: 0xffeebb, alpha: 0.25 });
  root.addChild(orbLeft);

  // ─── RIGHT: collect burst (coin-pop pattern) ──────────────────────────
  const collectBurst = new ParticleEmitter({
    texture: starTex,
    maxParticles: 80,
    emitting: false,
    lifespan: { min: 400, max: 700 },
    speed: { min: 60, max: 200 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.35, max: 0.8 }, end: 0 },
    tint: { start: 0xffee44, end: 0xff8833 },
    alpha: { start: 1, end: 0 },
    rotation: { min: 0, max: 360 },
  });
  collectBurst.x = cx + cx * 0.5;
  collectBurst.y = cy;
  root.addChild(collectBurst.container);

  // Spark ring behind burst
  const sparkRing = new ParticleEmitter({
    texture: sparkTex,
    maxParticles: 30,
    emitting: false,
    lifespan: { min: 200, max: 400 },
    speed: { min: 100, max: 260 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.2, max: 0.45 }, end: 0 },
    tint: { start: 0xffffff, end: 0xffcc44 },
    alpha: { start: 0.9, end: 0 },
  });
  sparkRing.x = collectBurst.x;
  sparkRing.y = collectBurst.y;
  root.addChild(sparkRing.container);

  // Coin placeholder that "disappears" on collect
  const coin = new Graphics();
  const coinX = cx + cx * 0.5;
  const coinY = cy;
  const drawCoin = (alpha: number) => {
    coin.clear();
    if (alpha <= 0) return;
    coin.circle(coinX, coinY, 11).fill({ color: 0xffee44, alpha });
    coin.circle(coinX, coinY, 8).fill({ color: 0xffcc22, alpha });
    coin.circle(coinX, coinY, 11).stroke({ color: 0xaa8800, width: 1.5, alpha });
  };
  drawCoin(1);
  root.addChild(coin);

  let coinAlpha = 1;
  let coinCooldown = 0;

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    coinCooldown = Math.max(0, coinCooldown - dt.deltaMS);
    if (coinAlpha < 1) {
      coinAlpha = Math.min(1, coinAlpha + dt.deltaMS / 400);
      drawCoin(coinAlpha);
    }
  };
  app.ticker.add(tick);

  burstTimer = setInterval(() => {
    if (cancelled) return;
    collectBurst.explode(28);
    sparkRing.explode(14);
    coinAlpha = 0;
    drawCoin(0);
    setTimeout(() => { if (!cancelled) drawCoin(1); coinAlpha = 1; }, 500);
  }, 1400);

  // fire once immediately
  setTimeout(() => {
    if (!cancelled) {
      collectBurst.explode(28);
      sparkRing.explode(14);
      coinAlpha = 0; drawCoin(0);
    }
  }, 500);

  return () => {
    cancelled = true;
    clearInterval(burstTimer);
    app.ticker.remove(tick);
    starTex.destroy(true);
    sparkTex.destroy(true);
    [bg, divider, orbLeft, coin, label, labelLeft, labelRight].forEach((e) => e.destroy());
    [ambientStars, collectBurst, sparkRing].forEach((e) => e.destroy());
  };
}
