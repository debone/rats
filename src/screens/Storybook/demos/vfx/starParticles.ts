/**
 * TECHNIQUE: Sprite Particles — shape determines emotional read (via VFX continuous + burst)
 *
 * Particle shape is not cosmetic — it changes what the effect communicates:
 *   Ball/circle  → neutral, generic, placeholder
 *   Star         → magical, collectible, reward, celebration
 *   Spark (line) → electrical, high-speed, dangerous
 *   Shard        → destruction, debris, impact
 *
 * Left  — starAura (ContinuousDef): ambient drift upward, "idle sparkle" aura
 * Right — starCollect (BurstDef): periodic burst, all angles, scale decay, "reward pop"
 *
 * Shows the same effect registry entry serving both a game system (vfx.attach,
 * vfx.play) and a storybook demo that drives the emitters directly.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { starAura } from '@/core/vfx/effects/starAura';
import { starCollect } from '@/core/vfx/effects/starCollect';
import type { BurstContext } from '@/core/vfx/types';

export function starParticles(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let burstTimer: ReturnType<typeof setInterval> | undefined;

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060810);
  root.addChild(bg);

  const divider = new Graphics();
  divider.moveTo(cx, 20).lineTo(cx, h - 20).stroke({ color: 0x1a1a2a, width: 1 });
  root.addChild(divider);

  const label = new Text({
    text: 'SPRITE PARTICLES — shape defines the feel  [continuous + burst]',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a3a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelLeft = new Text({
    text: 'starAura  ·  defineContinuous\n(ambient drift)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x4a5a9a, letterSpacing: 1 },
  });
  labelLeft.x = 8;
  labelLeft.y = h - 32;
  root.addChild(labelLeft);

  const labelRight = new Text({
    text: 'starCollect  ·  defineBurst\n(collect pop)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x9a8a3a, letterSpacing: 1 },
  });
  labelRight.x = cx + 8;
  labelRight.y = h - 32;
  root.addChild(labelRight);

  // ─── LEFT: starAura continuous emitter ────────────────────────────────
  // Use the effect's emitter() config directly — same config the game uses via vfx.attach()
  const ambientEmitter = new ParticleEmitter(starAura.emitter!());
  ambientEmitter.x = cx * 0.5;
  ambientEmitter.y = cy + 10;
  root.addChild(ambientEmitter.container);

  const orbLeft = new Graphics();
  orbLeft.circle(cx * 0.5, cy, 10).fill({ color: 0x8866ff, alpha: 0.12 });
  orbLeft.circle(cx * 0.5, cy, 5).fill({ color: 0xffeebb, alpha: 0.25 });
  root.addChild(orbLeft);

  // ─── RIGHT: starCollect burst emitter ─────────────────────────────────
  const collectEmitter = new ParticleEmitter(starCollect.emitter!());
  collectEmitter.x = cx + cx * 0.5;
  collectEmitter.y = cy;
  root.addChild(collectEmitter.container);

  const burstCtx: BurstContext = {
    emitter: collectEmitter,
    camera: null as any,
    layer: root,
  };

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

  burstTimer = setInterval(() => {
    if (cancelled) return;
    starCollect.play({ x: coinX, y: coinY }, burstCtx);
    drawCoin(0);
    setTimeout(() => { if (!cancelled) drawCoin(1); }, 500);
  }, 1400);

  setTimeout(() => {
    if (!cancelled) {
      starCollect.play({ x: coinX, y: coinY }, burstCtx);
      drawCoin(0);
    }
  }, 500);

  return () => {
    cancelled = true;
    clearInterval(burstTimer);
    ambientEmitter.destroy();
    collectEmitter.destroy();
    [bg, divider, orbLeft, coin, label, labelLeft, labelRight].forEach((e) => e.destroy());
  };
}
