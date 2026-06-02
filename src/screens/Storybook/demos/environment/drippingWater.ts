/**
 * ENVIRONMENT: Dripping Water
 *
 * Key techniques:
 * - Drip lifecycle: HANGING (elongates) → FALLING (separate drop with gravity)
 *   → IMPACT (ring + micro-splash particles)
 * - Surface ripples: an impact creates up to 3 expanding ring strokes;
 *   each ring has its own radius and alpha tracked in state
 * - Wavy water surface: sine-wave polyline redrawn each frame
 *
 * The drip "hangs" as a teardrop ellipse that grows; when it gets heavy
 * enough (random threshold) it snaps off. This snap is the drama moment.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface Drip {
  x: number;
  phase: 'hang' | 'fall';
  hangSize: number;       // how big the hanging drop is (0→maxHang)
  maxHang: number;
  y: number;
  vy: number;
  r: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: number;
}

export function drippingWater(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const ceilingH = h * 0.12;
  const poolY    = h * 0.7;

  // ─── Background ───────────────────────────────────────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x050810);
  root.addChild(bg);

  // Ceiling
  const ceiling = new Graphics();
  ceiling.rect(0, 0, w, ceilingH).fill(0x1a1410);
  // Stone texture
  for (let x = 0; x < w; x += 22 + Math.random() * 10) {
    ceiling.rect(x, 0, 1, ceilingH).fill({ color: 0x100c08, alpha: 0.6 });
  }
  ceiling.rect(0, ceilingH - 2, w, 2).fill(0x0e0a08);
  root.addChild(ceiling);

  // ─── Water pool (animated surface) ────────────────────────────────────
  const waterG = new Graphics();
  root.addChild(waterG);

  const splashG = new Graphics(); // for ripple rings
  root.addChild(splashG);

  // ─── Drip sources (stalagmite tips on ceiling) ────────────────────────
  const DRIP_X = [w * 0.22, w * 0.5, w * 0.75];
  const drips: Drip[] = DRIP_X.map((x) => ({
    x,
    phase: 'hang' as const,
    hangSize: Math.random() * 0.5,
    maxHang: 0.6 + Math.random() * 0.4,
    y: ceilingH,
    vy: 0,
    r: 3,
  }));
  const ripples: Ripple[] = [];
  const dripG = new Graphics();
  root.addChild(dripG);

  // Ceiling drip points (small protrusions)
  const ceilingDropG = new Graphics();
  DRIP_X.forEach((x) => {
    ceilingDropG.poly([x - 3, ceilingH, x + 3, ceilingH, x, ceilingH + 6]).fill(0x1e1612);
  });
  root.addChild(ceilingDropG);

  const label = new Text({
    text: 'ENV: DRIPPING WATER — hang → snap → fall → impact ripple lifecycle',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x1a3a4a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const spawnRipple = (x: number, y: number) => {
    ripples.push({ x, y, radius: 2, maxRadius: 18 + Math.random() * 12, alpha: 0.6, color: 0x4488cc });
    ripples.push({ x, y, radius: 1, maxRadius: 10 + Math.random() * 6,  alpha: 0.4, color: 0x88bbff });
  };

  const drawWaterSurface = (g: Graphics) => {
    g.clear();
    // Deep pool
    g.rect(0, poolY + 2, w, h - poolY).fill({ color: 0x061420, alpha: 0.95 });
    // Wavy surface as polyline
    const pts: number[] = [];
    for (let x = 0; x <= w; x += 3) {
      const y = poolY + Math.sin(x * 0.06 + time * 1.8) * 1.2 + Math.sin(x * 0.11 + time * 2.7) * 0.6;
      pts.push(x, y);
    }
    // Fill below surface
    pts.push(w, h, 0, h);
    g.poly(pts).fill({ color: 0x081828, alpha: 0.7 });
    // Surface highlight line
    g.moveTo(0, poolY);
    for (let x = 0; x <= w; x += 3) {
      const y = poolY + Math.sin(x * 0.06 + time * 1.8) * 1.2 + Math.sin(x * 0.11 + time * 2.7) * 0.6;
      g.lineTo(x, y);
    }
    g.stroke({ color: 0x4488aa, width: 0.8, alpha: 0.35 });

    // Ripple rings
    g.setStrokeStyle({ width: 1 });
    for (const r of ripples) {
      g.circle(r.x, r.y, r.radius).stroke({ color: r.color, width: 1, alpha: r.alpha });
    }
  };

  const GRAVITY = 300;

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;
    time += delta;

    // Update drips
    dripG.clear();
    for (const d of drips) {
      if (d.phase === 'hang') {
        d.hangSize += delta * (0.15 + Math.random() * 0.05);
        const bulge = d.hangSize / d.maxHang;
        const ry = 4 + bulge * 6;
        const rx = 2.5 + bulge * 1.5;
        dripG.ellipse(d.x, ceilingH + ry, rx, ry).fill({ color: 0x4488aa, alpha: 0.85 });
        dripG.ellipse(d.x - 0.8, ceilingH + ry * 0.4, rx * 0.3, ry * 0.25).fill({ color: 0xaaddff, alpha: 0.3 });

        if (d.hangSize >= d.maxHang) {
          d.phase = 'fall';
          d.y = ceilingH + ry * 2;
          d.vy = 20;
          d.r = rx;
          d.hangSize = 0;
          d.maxHang = 0.6 + Math.random() * 0.4;
        }
      } else {
        d.vy += GRAVITY * delta;
        d.y  += d.vy * delta;
        dripG.ellipse(d.x, d.y, d.r, d.r * 1.3).fill({ color: 0x4488aa, alpha: 0.8 });

        if (d.y >= poolY) {
          spawnRipple(d.x, poolY);
          d.phase = 'hang';
          d.y = ceilingH;
          d.vy = 0;
        }
      }
    }

    // Update ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const rate = (r.maxRadius - r.radius) * 2.2 * delta;
      r.radius = Math.min(r.maxRadius, r.radius + rate);
      r.alpha  = Math.max(0, r.alpha - delta * 1.4);
      if (r.alpha <= 0) ripples.splice(i, 1);
    }

    drawWaterSurface(waterG);
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    [bg, ceiling, waterG, splashG, dripG, ceilingDropG, label].forEach((e) => e.destroy());
  };
}
