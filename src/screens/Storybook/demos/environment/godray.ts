/**
 * ENVIRONMENT: God Ray / Crepuscular Light
 *
 * A light shaft from an overhead grate:
 * - Shape: trapezoid (narrow at grate, wide at floor) — NOT a gradient,
 *   just a filled polygon at very low alpha. Feels like scattering.
 * - Multiple overlapping trapezoids at different alphas = soft edge
 * - Beam breathes: alpha oscillates ±10% on a slow sine — living light
 * - Grate: grid of black rects over the light source, casts shadow stripes
 * - Dust motes: particles drift slowly within the beam (slight Brownian motion)
 *   They only feel like "dust in a beam" because they STAY INSIDE the beam area.
 *   Particles outside the beam would be invisible anyway; limiting them to the
 *   beam zone avoids wasted sprites and keeps the illusion coherent.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  phase: number;
}

export function godray(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const gX  = w / 2;        // grate center X
  const gY  = 0;             // grate top
  const gW  = w * 0.28;     // grate width
  const gH  = 14;            // grate thickness
  const beamW = gW * 2.6;   // beam width at floor
  const beamY  = h;

  // ─── Background: damp sewer room ─────────────────────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060810);
  // Floor suggestion
  bg.rect(0, h - 12, w, 12).fill(0x0e0c0a);
  bg.moveTo(0, h - 12).lineTo(w, h - 12).stroke({ color: 0x1a140e, width: 1 });
  root.addChild(bg);

  // Room details: grungy wall cracks, water stains
  const details = new Graphics();
  // Stain streaks below grate
  const sx = gX;
  details.moveTo(sx - 6, gH).lineTo(sx - 8, h * 0.5).stroke({ color: 0x0e1020, alpha: 0.5, width: 2 });
  details.moveTo(sx + 4, gH).lineTo(sx + 6, h * 0.55).stroke({ color: 0x0e1020, alpha: 0.4, width: 1.5 });
  root.addChild(details);

  // ─── Light beam (drawn behind grate, above ground) ─────────────────
  const beamG = new Graphics();
  root.addChild(beamG);

  // ─── Grate (drawn over beam) ──────────────────────────────────────────
  const grate = new Graphics();
  // Grate frame
  grate.roundRect(gX - gW / 2 - 2, gY, gW + 4, gH, 1).fill(0x1a1208);
  grate.roundRect(gX - gW / 2 - 2, gY, gW + 4, gH, 1).stroke({ color: 0x0a0806, width: 1 });
  // Grid bars - horizontal
  for (let gy = 3; gy < gH - 2; gy += 4) {
    grate.rect(gX - gW / 2, gY + gy, gW, 1.5).fill(0x0c0a06);
  }
  // Grid bars - vertical (casting shadow stripes)
  const BAR_COUNT = 7;
  for (let i = 0; i <= BAR_COUNT; i++) {
    const bx = gX - gW / 2 + i * (gW / BAR_COUNT);
    grate.rect(bx - 1, gY, 2, gH).fill(0x0c0a06);
  }
  root.addChild(grate);

  // ─── Dust motes ───────────────────────────────────────────────────────
  const moteG = new Graphics();
  root.addChild(moteG);

  const motes: Mote[] = Array.from({ length: 28 }, () => {
    const t = Math.random();
    const bx = gX + (t - 0.5) * (gW + (beamW - gW) * Math.random());
    return {
      x: bx,
      y: gH + Math.random() * (beamY - gH),
      vx: (Math.random() - 0.5) * 4,
      vy: -2 - Math.random() * 5,
      alpha: 0.2 + Math.random() * 0.5,
      size: 0.5 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    };
  });

  const label = new Text({
    text: 'ENV: GOD RAY — layered trapezoid + grate shadow strips + dust motes',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a3a1a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  // Shadow stripe X positions from vertical grate bars
  const stripeXs: number[] = [];
  for (let i = 0; i <= BAR_COUNT; i++) {
    stripeXs.push(gX - gW / 2 + i * (gW / BAR_COUNT));
  }

  const drawBeam = (alpha: number) => {
    beamG.clear();

    // Beam as two overlapping trapezoids (wide base = soft edge)
    const halfTop = gW / 2;
    const halfBot = beamW / 2;
    const beamPoly = [
      gX - halfTop, gY + gH,
      gX + halfTop, gY + gH,
      gX + halfBot, beamY,
      gX - halfBot, beamY,
    ];
    beamG.poly(beamPoly).fill({ color: 0xc8d860, alpha: alpha * 0.07 });

    const narrowPoly = [
      gX - halfTop * 0.6, gY + gH,
      gX + halfTop * 0.6, gY + gH,
      gX + halfBot * 0.5, beamY,
      gX - halfBot * 0.5, beamY,
    ];
    beamG.poly(narrowPoly).fill({ color: 0xd8f080, alpha: alpha * 0.05 });

    // Shadow stripes from grate bars
    for (const sx of stripeXs) {
      // Project bar from grate X down to floor at same angle as beam edge
      const t = halfBot / (halfTop || 1);
      const bx2 = gX + (sx - gX) * t;
      const shadowPoly = [
        sx - 1, gY + gH,
        sx + 1, gY + gH,
        bx2 + 2.5, beamY,
        bx2 - 2.5, beamY,
      ];
      beamG.poly(shadowPoly).fill({ color: 0x000000, alpha: 0.15 });
    }
  };

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;
    time += delta;

    // Beam breathes slightly
    const beamAlpha = 1 + Math.sin(time * 0.8) * 0.1;
    drawBeam(beamAlpha);

    // Dust motes — Brownian drift inside beam
    moteG.clear();
    for (const m of motes) {
      m.vx += (Math.random() - 0.5) * 3 * delta;
      m.vy += (Math.random() - 0.5) * 1.5 * delta;
      // Dampen: keep slow
      m.vx *= 0.97;
      m.vy = m.vy * 0.97 - 1.5 * delta; // slow upward drift
      m.x += m.vx * delta;
      m.y += m.vy * delta;

      // Respawn at bottom when they drift above grate
      if (m.y < gY + gH - 4) {
        m.y = beamY - 4;
        m.x = gX + (Math.random() - 0.5) * beamW;
      }
      // Keep within beam X bounds approximately
      const beamXAt = (y: number) => {
        const t2 = (y - gY - gH) / (beamY - gY - gH);
        return (gW / 2 + t2 * (beamW / 2 - gW / 2));
      };
      const halfW = beamXAt(m.y);
      if (m.x < gX - halfW - 8) m.x = gX - halfW + Math.random() * 10;
      if (m.x > gX + halfW + 8) m.x = gX + halfW - Math.random() * 10;

      const twinkle = 0.6 + Math.sin(time * 2.1 + m.phase) * 0.35;
      moteG.circle(m.x, m.y, m.size).fill({ color: 0xddeecc, alpha: m.alpha * twinkle });
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    [bg, details, beamG, grate, moteG, label].forEach((e) => e.destroy());
  };
}
