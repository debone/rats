/**
 * TECHNIQUE: Composite VFX — Ribbon Trail + Sprite Particles  (via continuous + screen)
 *
 * Demonstrates why combining techniques multiplies the effect:
 *
 * Trail alone  → shows the path but feels static/flat at the head
 * Particles alone → feel disconnected, no sense of motion direction
 * Screen bloom → all bright pixels glow, unifying trail + particles into magic
 * Together     → trail anchors the history; particles add density at the head;
 *                bloom fuses both into a coherent glowing trail
 *
 * Orb follows a Lissajous figure-8 path.
 * orbAura (ContinuousDef) supplies the particle crown at the orb head.
 * trailBloom (ScreenDef) applies a soft bloom filter to the whole layer.
 * The ribbon trail records the last N positions as a tapered polygon.
 */
import { Container, Graphics, Text, type Filter } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { orbAura, getOrbPuffTexture } from '@/core/vfx/effects/orbAura';
import { trailBloom } from '@/core/vfx/effects/screen/trailBloom';

const MAX_POINTS = 55;

export function magicTrail(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060810);
  root.addChild(bg);

  const trailG = new Graphics();
  root.addChild(trailG);

  const label = new Text({
    text: 'COMPOSITE — ribbon trail + particle crown + bloom  [continuous + screen]',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a2a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'orbAura  ·  defineContinuous   ·   trailBloom  ·  defineScreen  (bloom filter)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x2a1a4a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  // ─── orbAura: star particle crown (primary emitter from effect definition) ──
  const starEmitter = new ParticleEmitter(orbAura.emitter!());
  root.addChild(starEmitter.container);

  // Soft puff layer — secondary emitter using the effect's exported puff texture
  const puffEmitter = new ParticleEmitter({
    texture: getOrbPuffTexture(),
    maxParticles: 30,
    emitting: true,
    frequency: 80,
    quantity: 1,
    lifespan: { min: 400, max: 700 },
    speed: { min: 3, max: 18 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.15, max: 0.35 }, end: 0.6 },
    tint: { start: 0xaa88ff, end: 0x220044 },
    alpha: { start: 0.35, end: 0 },
  });
  root.addChild(puffEmitter.container);

  // ─── trailBloom: screen filter — apply bloom to the whole demo layer ─────
  const bloomFilter = trailBloom.create() as Filter;
  root.filters = [bloomFilter];

  const orb = new Graphics();
  root.addChild(orb);

  const pts: { x: number; y: number }[] = [];

  const drawTrail = (points: { x: number; y: number }[]) => {
    trailG.clear();
    if (points.length < 3) return;
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1);
      const halfW = t * 7;
      const p = points[i];
      const next = points[Math.min(i + 1, points.length - 1)];
      const prev = points[Math.max(i - 1, 0)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      left.push(p.x + (-dy / len) * halfW, p.y + (dx / len) * halfW);
      right.push(p.x - (-dy / len) * halfW, p.y - (dx / len) * halfW);
    }
    const poly = [...left];
    for (let i = right.length - 2; i >= 0; i -= 2) poly.push(right[i], right[i + 1]);
    trailG.poly(poly).fill({ color: 0x6633cc, alpha: 0.45 });
    if (points.length >= 2) {
      trailG.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) trailG.lineTo(points[i].x, points[i].y);
      trailG.stroke({ color: 0xccaaff, width: 0.8, alpha: 0.25 });
    }
  };

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;

    const x = cx + Math.sin(time * 1.1) * (w * 0.36);
    const y = cy + Math.sin(time * 2.2) * (h * 0.28);

    pts.push({ x, y });
    if (pts.length > MAX_POINTS) pts.shift();
    drawTrail(pts);

    // Position emitters at orb head — mirrors what vfx.attach() does via position()
    starEmitter.x = x;
    starEmitter.y = y;
    puffEmitter.x = x;
    puffEmitter.y = y;

    orb.clear();
    orb.circle(x, y, 5).fill({ color: 0xffeebb, alpha: 0.95 });
    orb.circle(x, y, 9).fill({ color: 0xaa88ff, alpha: 0.35 });
    orb.circle(x, y, 14).fill({ color: 0x6633cc, alpha: 0.12 });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    root.filters = [];
    bloomFilter.destroy();
    starEmitter.destroy();
    puffEmitter.destroy();
    [bg, trailG, orb, label, labelB].forEach((e) => e.destroy());
  };
}
