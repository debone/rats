/**
 * TECHNIQUE: Composite VFX — Ribbon Trail + Sprite Particles
 *
 * Demonstrates why combining techniques multiplies the effect:
 *
 * Trail alone  → shows the path but feels static/flat at the head
 * Particles alone → feel disconnected, no sense of motion direction
 * Together     → trail anchors the history; particles add density and
 *               sparkle exactly where the action currently is
 *
 * Orb follows a Lissajous figure-8 path.
 * Ribbon trail records the last N positions and builds a tapered polygon.
 * ParticleEmitter sits at the orb's current position, emitting continuously.
 *
 * This "trail head + particle crown" pattern is used in every action-RPG
 * spell trail, character dash, and projectile arc.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeStarTexture, makeSoftPuffTexture } from '../particleTextures';

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
    text: 'COMPOSITE — ribbon trail + particle crown (figure-8 path)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a2a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'trail = history  |  particles = current position density  |  together = magic',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x2a1a4a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  // Bake textures
  const starTex = makeStarTexture();
  const puffTex = makeSoftPuffTexture();

  // ─── Particle crown at the orb head ──────────────────────────────────
  // Stars: tight cluster, low speed, short life → "density halo"
  const starEmitter = new ParticleEmitter({
    texture: starTex,
    maxParticles: 80,
    emitting: true,
    frequency: 40,
    quantity: 1,
    lifespan: { min: 300, max: 600 },
    speed: { min: 5, max: 35 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.2, max: 0.55 }, end: 0 },
    tint: { start: 0xffeebb, end: 0x8833ff },
    alpha: { start: 0.9, end: 0 },
    rotation: { min: 0, max: 360 },
  });
  root.addChild(starEmitter.container);

  // Soft puff: even slower, larger, provides the glow behind the stars
  const puffEmitter = new ParticleEmitter({
    texture: puffTex,
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

  // Orb glow drawn each frame
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
      const halfW = t * 7; // tapers from 0 at tail to 7px at head
      const p = points[i];
      const next = points[Math.min(i + 1, points.length - 1)];
      const prev = points[Math.max(i - 1, 0)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = (-dy / len) * halfW;
      const ny = (dx / len) * halfW;
      left.push(p.x + nx, p.y + ny);
      right.push(p.x - nx, p.y - ny);
    }

    const poly = [...left];
    for (let i = right.length - 2; i >= 0; i -= 2) poly.push(right[i], right[i + 1]);

    // Two-layer trail: wide soft glow + narrow bright core
    trailG.poly(poly).fill({ color: 0x6633cc, alpha: 0.45 });

    // Spine follows the actual curve
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

    // Move emitters to orb head
    starEmitter.x = x;
    starEmitter.y = y;
    puffEmitter.x = x;
    puffEmitter.y = y;

    // Orb glow
    orb.clear();
    orb.circle(x, y, 5).fill({ color: 0xffeebb, alpha: 0.95 });
    orb.circle(x, y, 9).fill({ color: 0xaa88ff, alpha: 0.35 });
    orb.circle(x, y, 14).fill({ color: 0x6633cc, alpha: 0.12 });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    starTex.destroy(true);
    puffTex.destroy(true);
    [starEmitter, puffEmitter].forEach((e) => e.destroy());
    [bg, trailG, orb, label, labelB].forEach((e) => e.destroy());
  };
}
