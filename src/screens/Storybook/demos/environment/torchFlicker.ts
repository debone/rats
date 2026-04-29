/**
 * ENVIRONMENT: Torch Flicker
 *
 * Key techniques:
 * - Layered animated flame: 3 stacked ellipses at offset Y, each wobbling
 *   independently via sine waves with slightly different frequencies
 * - Light corona: large low-alpha circle whose radius and alpha oscillate
 *   — the viewer reads this as "dynamic light source" without any real lighting
 * - Ember particles: slow upward drift, fade out, no respawn = ash
 * - Wall warm tint: a semi-transparent orange rect behind the torch corona
 *   grades the stone wall without a real light engine
 *
 * The flame wobble is: each layer has its own phase offset so they don't
 * move in lockstep. Synchronized wobble looks mechanical; offset looks alive.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeSparkTexture } from '../particleTextures';

export function torchFlicker(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const torchX = w / 2;
  const torchY = h * 0.55;

  // ─── Stone wall background ────────────────────────────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x100e0c);
  // Horizontal mortar lines
  for (let y = 0; y < h; y += 16) {
    bg.rect(0, y, w, 1).fill({ color: 0x0a0806, alpha: 0.7 });
  }
  // Vertical mortar (staggered per row)
  for (let row = 0; row * 16 < h; row++) {
    const offset = (row % 2) * 18;
    for (let x = offset; x < w + 36; x += 36) {
      bg.rect(x, row * 16, 1, 15).fill({ color: 0x0a0806, alpha: 0.5 });
    }
  }
  root.addChild(bg);

  // ─── Wall warm tint (simulates light falloff on the wall) ─────────────
  const wallTint = new Graphics();
  wallTint.circle(torchX, torchY, 80).fill({ color: 0xff6600, alpha: 0.04 });
  wallTint.circle(torchX, torchY, 50).fill({ color: 0xff8800, alpha: 0.04 });
  root.addChild(wallTint);

  // ─── Light corona ─────────────────────────────────────────────────────
  const corona = new Graphics();
  root.addChild(corona);

  // ─── Torch mount (iron bracket) ───────────────────────────────────────
  const mount = new Graphics();
  // Wall bracket arm
  mount.rect(torchX - 1, torchY - 2, 2, 14).fill(0x4a3a28);
  // Horizontal rod
  mount.rect(torchX - 8, torchY + 10, 16, 3).fill(0x3a2a1a);
  // End caps
  mount.circle(torchX - 8, torchY + 11.5, 2.5).fill(0x2a1a0a);
  mount.circle(torchX + 8, torchY + 11.5, 2.5).fill(0x2a1a0a);
  // Torch body (wrapped cloth cylinder)
  mount.roundRect(torchX - 3, torchY - 14, 6, 14, 1).fill(0x5a3a18);
  mount.rect(torchX - 3, torchY - 10, 6, 2).fill({ color: 0x442810, alpha: 0.7 });
  mount.rect(torchX - 3, torchY - 6, 6, 2).fill({ color: 0x442810, alpha: 0.7 });
  root.addChild(mount);

  // ─── Flame layers (redrawn each frame) ───────────────────────────────
  const flame = new Graphics();
  root.addChild(flame);

  // ─── Ember particles ──────────────────────────────────────────────────
  const sparkTex = makeSparkTexture();
  const embers = new ParticleEmitter({
    texture: sparkTex,
    maxParticles: 20,
    emitting: true,
    frequency: 280,
    quantity: 1,
    lifespan: { min: 1200, max: 2400 },
    speed: { min: 10, max: 35 },
    angle: { min: 250, max: 290 },
    scale: { start: { min: 0.12, max: 0.25 }, end: 0 },
    tint: { start: 0xffcc44, end: 0xff4400 },
    alpha: { start: 0.8, end: 0 },
  });
  embers.x = torchX;
  embers.y = torchY - 18;
  root.addChild(embers.container);

  const label = new Text({
    text: 'ENV: TORCH FLICKER — layered animated flame + corona light + ember particles',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x5a3a18, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;

    // ── Corona: radius and alpha oscillate on offset frequencies ──
    const coronaR = 55 + Math.sin(time * 3.1) * 6 + Math.sin(time * 7.3) * 3;
    const coronaA = 0.10 + Math.sin(time * 4.2) * 0.025;
    corona.clear();
    corona.circle(torchX, torchY - 16, coronaR * 1.4).fill({ color: 0xff6600, alpha: coronaA * 0.4 });
    corona.circle(torchX, torchY - 16, coronaR).fill({ color: 0xff8800, alpha: coronaA });
    corona.circle(torchX, torchY - 16, coronaR * 0.5).fill({ color: 0xffcc44, alpha: coronaA * 0.6 });

    // ── Flame: three layers, each with independent wobble phase ──
    flame.clear();

    // Outer base (orange, wide)
    const s0x = 1.0 + Math.sin(time * 6.7 + 0.0) * 0.18;
    const s0y = 1.0 + Math.sin(time * 5.3 + 1.0) * 0.10;
    flame.ellipse(
      torchX + Math.sin(time * 8.1) * 1.5,
      torchY - 18,
      6 * s0x, 11 * s0y,
    ).fill({ color: 0xff5500, alpha: 0.85 });

    // Mid (yellow, narrower)
    const s1x = 1.0 + Math.sin(time * 8.2 + 2.1) * 0.22;
    const s1y = 1.0 + Math.sin(time * 6.1 + 0.5) * 0.12;
    flame.ellipse(
      torchX + Math.sin(time * 9.3 + 0.7) * 1.2,
      torchY - 22,
      4 * s1x, 9 * s1y,
    ).fill({ color: 0xffbb00, alpha: 0.9 });

    // Tip (white-yellow, tiny)
    const s2x = 1.0 + Math.sin(time * 11.5 + 4.2) * 0.28;
    const s2y = 1.0 + Math.sin(time * 9.8 + 3.0) * 0.15;
    flame.ellipse(
      torchX + Math.sin(time * 13.1 + 1.4) * 0.8,
      torchY - 27,
      2 * s2x, 5 * s2y,
    ).fill({ color: 0xffffcc, alpha: 0.95 });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    sparkTex.destroy(true);
    embers.destroy();
    [bg, wallTint, corona, mount, flame, label].forEach((e) => e.destroy());
  };
}
