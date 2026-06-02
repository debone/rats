/**
 * ENVIRONMENT: Rain Streaks
 *
 * Rain is drawn as oriented line-segments, NOT sprites:
 * - Each streak has a fixed angle (≈75° from horizontal)
 * - Length is proportional to speed (fast rain = long streaks)
 * - Width is 1px — wide streaks look painted, not rain
 *
 * Ground interaction:
 * - At y=groundY: spawn a 2-ring ripple (same lifecycle as drippingWater)
 * - Puddle areas drawn as slightly brighter floor patches
 *
 * Performance note: all streaks drawn into ONE Graphics clear-redraw
 * per frame. Batching N line calls into one Graphics is far cheaper
 * than N Sprite objects each frame.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const STREAK_COUNT = 90;
const RAIN_ANGLE   = 78 * Math.PI / 180;  // from vertical
const RAIN_SPEED   = 420;                  // px/s
const STREAK_LEN   = 14;

interface Streak {
  x: number;
  y: number;
  alpha: number;
  len: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export function rainStreaks(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const groundY = h * 0.78;
  const vx = Math.sin(RAIN_ANGLE) * RAIN_SPEED;
  const vy = Math.cos(RAIN_ANGLE) * RAIN_SPEED;

  // ─── Background: night exterior / sewer entrance ─────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x06080e);
  // Sky gradient suggestion
  bg.rect(0, 0, w, groundY).fill({ color: 0x070a14, alpha: 0.6 });
  root.addChild(bg);

  // Distant building silhouettes
  const city = new Graphics();
  const bldgs = [
    { x: 0,         bw: w * 0.14, bh: h * 0.28 },
    { x: w * 0.12,  bw: w * 0.10, bh: h * 0.40 },
    { x: w * 0.20,  bw: w * 0.18, bh: h * 0.22 },
    { x: w * 0.45,  bw: w * 0.08, bh: h * 0.35 },
    { x: w * 0.52,  bw: w * 0.20, bh: h * 0.30 },
    { x: w * 0.75,  bw: w * 0.14, bh: h * 0.38 },
    { x: w * 0.88,  bw: w * 0.12, bh: h * 0.24 },
  ];
  bldgs.forEach(({ x: bx, bw: bw2, bh }) => {
    city.rect(bx, groundY - bh, bw2, bh).fill(0x080c10);
    // One or two lit windows
    for (let wi = 0; wi < 3; wi++) {
      if (Math.random() > 0.45) {
        city.rect(bx + Math.random() * (bw2 - 5), groundY - bh + Math.random() * (bh - 6), 3, 4)
            .fill({ color: 0xffeebb, alpha: 0.35 });
      }
    }
  });
  root.addChild(city);

  // Ground / wet street
  const ground = new Graphics();
  ground.rect(0, groundY, w, h - groundY).fill(0x0c0e14);
  // Puddle reflection patches (lighter areas = standing water)
  [[w * 0.15, 22], [w * 0.42, 30], [w * 0.65, 18], [w * 0.85, 14]].forEach(([px, pw]) => {
    ground.ellipse(px, groundY + 5, pw, 4).fill({ color: 0x1a2030, alpha: 0.8 });
    // Faint reflection of lights above in puddle
    ground.ellipse(px, groundY + 5, pw * 0.5, 2).fill({ color: 0x8899bb, alpha: 0.08 });
  });
  ground.moveTo(0, groundY).lineTo(w, groundY).stroke({ color: 0x1a2030, width: 1 });
  root.addChild(ground);

  // ─── Rain layer ───────────────────────────────────────────────────────
  const rainG = new Graphics();
  root.addChild(rainG);

  const rippleG = new Graphics();
  root.addChild(rippleG);

  // Initialise streaks scattered across the field
  const streaks: Streak[] = Array.from({ length: STREAK_COUNT }, () => ({
    x: Math.random() * (w + 60) - 30,
    y: Math.random() * h,
    alpha: 0.25 + Math.random() * 0.45,
    len: STREAK_LEN * (0.6 + Math.random() * 0.8),
  }));

  const ripples: Ripple[] = [];

  const label = new Text({
    text: 'ENV: RAIN — angled line segments batched into one Graphics per frame',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x1a2a3a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'puddle ripples + wet ground reflection — all ≤ 2 draw calls',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x0e1828, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;
    time += delta;

    // Advance all streaks, redraw into one Graphics clear
    rainG.clear();
    for (const s of streaks) {
      s.x += vx * delta;
      s.y += vy * delta;

      // Tail and head of the streak line
      const tx = s.x - Math.sin(RAIN_ANGLE) * s.len;
      const ty = s.y - Math.cos(RAIN_ANGLE) * s.len;
      rainG.moveTo(tx, ty).lineTo(s.x, s.y)
           .stroke({ color: 0x99aabb, width: 0.8, alpha: s.alpha });

      if (s.y >= groundY) {
        // Impact ripple
        if (s.x > 0 && s.x < w) {
          ripples.push({ x: s.x, y: groundY, radius: 1, maxRadius: 8 + Math.random() * 5, alpha: 0.5 });
        }
        // Wrap back to top-left off-screen
        s.y = -s.len - Math.random() * 20;
        s.x = Math.random() * (w + 60) - 30;
      }
    }

    // Ripples
    rippleG.clear();
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const rate = (r.maxRadius - r.radius) * 3 * delta;
      r.radius = Math.min(r.maxRadius, r.radius + rate);
      r.alpha  = Math.max(0, r.alpha - delta * 2.2);
      if (r.alpha <= 0) { ripples.splice(i, 1); continue; }
      rippleG.ellipse(r.x, r.y, r.radius, r.radius * 0.4)
             .stroke({ color: 0x4466aa, width: 0.7, alpha: r.alpha });
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    [bg, city, ground, rainG, rippleG, label, labelB].forEach((e) => e.destroy());
  };
}
