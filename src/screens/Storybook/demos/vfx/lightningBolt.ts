/**
 * TECHNIQUE: Procedural Lightning — recursive midpoint displacement
 *
 * Subdivide a line segment: find midpoint, displace it perpendicular to
 * the segment by a random amount proportional to segment length × roughness.
 * Recurse on both halves. After 5 passes, the zigzag reads as lightning.
 *
 * Branching: after subdivision, sprout side bolts from random intermediate
 * points at ±30° — the branch recurses with lower depth and higher roughness.
 *
 * Screen-wide flash fires 1 frame before the bolt appears — "thunderclap"
 * timing is what makes it feel physical, not just the line.
 *
 * All procedural — zero textures, pure Graphics lines every strike.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

type Pt = { x: number; y: number };

function subdivide(pts: Pt[], roughness: number, depth: number): Pt[] {
  if (depth === 0) return pts;
  const result: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    result.push(pts[i]);
    const a = pts[i], b = pts[i + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    // Perpendicular unit vector
    const px = -dy / (len || 1);
    const py = dx / (len || 1);
    const disp = (Math.random() - 0.5) * len * roughness;
    result.push({ x: mx + px * disp, y: my + py * disp });
  }
  result.push(pts[pts.length - 1]);
  return subdivide(result, roughness * 0.65, depth - 1);
}

function drawBolt(g: Graphics, pts: Pt[], alpha: number, width: number, color: number) {
  if (pts.length < 2) return;
  // Outer glow pass
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ color, width: width * 3, alpha: alpha * 0.18 });
  // Core
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ color, width, alpha });
  // Bright centre
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ color: 0xffffff, width: width * 0.4, alpha: alpha * 0.7 });
}

function generateLightningPts(x1: number, y1: number, x2: number, y2: number): Pt[] {
  return subdivide([{ x: x1, y: y1 }, { x: x2, y: y2 }], 0.55, 5);
}

export function lightningBolt(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x06060e);
  root.addChild(bg);

  // Cityscape silhouette for depth
  const city = new Graphics();
  for (let x = 0; x < w; x += 12 + Math.floor(Math.random() * 16)) {
    const bh = 14 + Math.random() * 30;
    city.rect(x, h - bh, 10 + Math.random() * 8, bh).fill({ color: 0x0a0a18, alpha: 0.9 });
  }
  root.addChild(city);

  const flashLayer = new Graphics();
  root.addChild(flashLayer);

  const boltLayer = new Graphics();
  root.addChild(boltLayer);

  const label = new Text({
    text: 'PROCEDURAL LIGHTNING — recursive midpoint displacement',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a2a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'depth=5, roughness=0.55 — no artist input, pure math',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x1a1a4a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  // Strike state
  interface Strike {
    mainPts: Pt[];
    branches: Pt[][];
    age: number;
    duration: number;
    color: number;
  }

  let activeStrike: Strike | null = null;
  let flashAge = -1;

  const COLORS = [0xaaccff, 0xcc99ff, 0xffffff, 0x88ffff];

  const launchStrike = () => {
    if (cancelled) return;
    const startX = w * 0.2 + Math.random() * w * 0.6;
    const startY = 0;
    const endX = startX + (Math.random() - 0.5) * w * 0.4;
    const endY = h - 20 - Math.random() * h * 0.3;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const mainPts = generateLightningPts(startX, startY, endX, endY);
    const branches: Pt[][] = [];

    // Grow 2–3 branches from random intermediate points
    const branchCount = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < branchCount; b++) {
      const idx = Math.floor(mainPts.length * (0.3 + Math.random() * 0.4));
      if (idx >= mainPts.length) continue;
      const origin = mainPts[idx];
      const bLen = 30 + Math.random() * 50;
      // Angle ≈ main bolt direction ± 25–45°
      const dx = mainPts[mainPts.length - 1].x - mainPts[0].x;
      const dy = mainPts[mainPts.length - 1].y - mainPts[0].y;
      const baseAngle = Math.atan2(dy, dx);
      const branchAngle = baseAngle + (Math.random() - 0.5) * 1.2;
      const bEnd = {
        x: origin.x + Math.cos(branchAngle) * bLen,
        y: origin.y + Math.sin(branchAngle) * bLen,
      };
      branches.push(subdivide([origin, bEnd], 0.75, 4));
    }

    activeStrike = { mainPts, branches, age: 0, duration: 180 + Math.random() * 100, color };
    flashAge = 0;
  };

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;

    flashLayer.clear();
    boltLayer.clear();

    if (flashAge >= 0) {
      flashAge += dt.deltaMS;
      const fa = Math.max(0, 1 - flashAge / 90);
      if (fa > 0) {
        flashLayer.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: fa * 0.45 });
      } else {
        flashAge = -1;
      }
    }

    if (activeStrike) {
      activeStrike.age += dt.deltaMS;
      const t = activeStrike.age / activeStrike.duration;
      const alpha = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);

      drawBolt(boltLayer, activeStrike.mainPts, alpha, 1.5, activeStrike.color);
      activeStrike.branches.forEach((bPts) => {
        drawBolt(boltLayer, bPts, alpha * 0.65, 0.9, activeStrike!.color);
      });

      if (activeStrike.age >= activeStrike.duration) {
        activeStrike = null;
      }
    }
  };

  // Schedule strikes
  const scheduleNext = () => {
    if (cancelled) return;
    const gap = 800 + Math.random() * 1200;
    timer = setTimeout(() => {
      launchStrike();
      scheduleNext();
    }, gap);
  };

  // Initial
  timer = setTimeout(launchStrike, 300);
  scheduleNext();

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    app.ticker.remove(tick);
    [bg, city, flashLayer, boltLayer, label, labelB].forEach((e) => e.destroy());
  };
}
