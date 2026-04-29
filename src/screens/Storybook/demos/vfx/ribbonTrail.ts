/**
 * TECHNIQUE: Trail / Ribbon Renderer — continuous motion trail
 *
 * Same ribbon polygon technique as swordTrail but driven continuously by
 * the ticker. An orb follows a figure-8 path; the ribbon builds behind it.
 * Shows how the trail reads as "speed" and "path history" simultaneously.
 *
 * Key difference from particles: every past position is preserved and
 * connected — the shape is the history of the motion, not random emission.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const MAX_POINTS = 50;

function buildRibbon(pts: { x: number; y: number }[], maxW: number, color: number): void {
  // Defined inline so each caller can have its own Graphics
}

export function ribbonTrail(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x06080e);
  root.addChild(bg);

  const trail1 = new Graphics();
  root.addChild(trail1);
  const trail2 = new Graphics();
  root.addChild(trail2);

  // Orb glow
  const orb = new Graphics();
  root.addChild(orb);

  const label = new Text({
    text: 'TRAIL RENDERER — continuous position history',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a3a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const pts1: { x: number; y: number }[] = [];
  const pts2: { x: number; y: number }[] = [];

  const drawRibbon = (g: Graphics, pts: { x: number; y: number }[], maxW: number, color: number) => {
    g.clear();
    if (pts.length < 3) return;

    const left: number[] = [];
    const right: number[] = [];

    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const w = t * maxW;
      const p = pts[i];
      const next = pts[Math.min(i + 1, pts.length - 1)];
      const prev = pts[Math.max(i - 1, 0)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      left.push(p.x + (-dy / len) * w * 0.5, p.y + (dx / len) * w * 0.5);
      right.push(p.x - (-dy / len) * w * 0.5, p.y - (dx / len) * w * 0.5);
    }

    const poly = [...left];
    for (let i = right.length - 2; i >= 0; i -= 2) poly.push(right[i], right[i + 1]);

    g.poly(poly).fill({ color, alpha: 0.6 });

    // Spine follows the actual curve (not a straight shortcut between endpoints)
    if (pts.length >= 2) {
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke({ color: 0xffffff, width: 0.6, alpha: 0.2 });
    }
  };

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS * 0.001;

    // Lissajous figure-8 path (orb 1)
    const x1 = cx + Math.sin(time * 1.3) * (w * 0.35);
    const y1 = cy + Math.sin(time * 2.6) * (h * 0.3);

    // Phase-shifted second orb
    const x2 = cx + Math.sin(time * 1.3 + Math.PI) * (w * 0.35);
    const y2 = cy + Math.sin(time * 2.6 + Math.PI) * (h * 0.3);

    pts1.push({ x: x1, y: y1 });
    if (pts1.length > MAX_POINTS) pts1.shift();

    pts2.push({ x: x2, y: y2 });
    if (pts2.length > MAX_POINTS) pts2.shift();

    drawRibbon(trail1, pts1, 10, 0x4488ff);
    drawRibbon(trail2, pts2, 8, 0xff6644);

    // Orb at head of trail1
    orb.clear();
    orb.circle(x1, y1, 4).fill({ color: 0xaaccff, alpha: 0.9 });
    orb.circle(x1, y1, 7).fill({ color: 0x6699ff, alpha: 0.3 });
    orb.circle(x2, y2, 3).fill({ color: 0xffbb88, alpha: 0.9 });
    orb.circle(x2, y2, 6).fill({ color: 0xff8855, alpha: 0.3 });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    [bg, trail1, trail2, orb, label].forEach((e) => e.destroy());
  };
}
