/**
 * TECHNIQUE: Trail / Ribbon Renderer — sword swing
 *
 * Record the last N positions of a moving point, then draw a tapered filled
 * polygon through those points. Width at the head = max, width at the tail = 0.
 * NOT particles — this is a dynamically generated mesh redrawn each frame.
 *
 * Used for: sword arcs, whip cracks, energy blade trails, magic wand paths.
 */
import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const MAX_POINTS = 28;
const MAX_WIDTH = 14;
const SWORD_LEN = 38;
const HANDLE_LEN = 10;

function buildRibbonPolygon(pts: { x: number; y: number }[], maxW: number): number[] | null {
  if (pts.length < 2) return null;
  const left: number[] = [];
  const right: number[] = [];

  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1); // 0=tail, 1=head
    const w = t * maxW;
    const p = pts[i];
    const next = pts[Math.min(i + 1, pts.length - 1)];
    const prev = pts[Math.max(i - 1, 0)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * w * 0.5;
    const ny = (dx / len) * w * 0.5;
    left.push(p.x + nx, p.y + ny);
    right.push(p.x - nx, p.y - ny);
  }

  const poly = [...left];
  for (let i = right.length - 2; i >= 0; i -= 2) {
    poly.push(right[i], right[i + 1]);
  }
  return poly;
}

export function swordTrail(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080810);
  root.addChild(bg);

  const trail = new Graphics();
  root.addChild(trail);

  const sword = new Graphics();
  root.addChild(sword);

  const label = new Text({
    text: 'TRAIL RENDERER — polygon mesh from position history',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a3a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const drawSword = (tipX: number, tipY: number, baseX: number, baseY: number) => {
    const dx = tipX - baseX;
    const dy = tipY - baseY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * 2;
    const ny = (dx / len) * 2;

    sword.clear();
    // Blade
    sword
      .moveTo(baseX, baseY)
      .lineTo(tipX, tipY)
      .stroke({ color: 0xddeeff, width: 2 });
    // Edge glint
    sword
      .moveTo(baseX + nx, baseY + ny)
      .lineTo(tipX + nx * 0.3, tipY + ny * 0.3)
      .stroke({ color: 0xffffff, width: 0.8, alpha: 0.6 });
    // Guard
    sword
      .moveTo(baseX - nx * 3, baseY - ny * 3)
      .lineTo(baseX + nx * 3, baseY + ny * 3)
      .stroke({ color: 0xaa8844, width: 2 });
    // Handle
    const hx = baseX - (dx / len) * HANDLE_LEN;
    const hy = baseY - (dy / len) * HANDLE_LEN;
    sword
      .moveTo(baseX, baseY)
      .lineTo(hx, hy)
      .stroke({ color: 0x886633, width: 3 });
  };

  const pts: { x: number; y: number }[] = [];

  const play = async () => {
    if (cancelled) return;
    pts.length = 0;
    trail.clear();
    sword.clear();

    // Each swing: pivot at cx,cy, tip sweeps an arc
    const SWINGS = [
      { from: -2.2, to: 0.4, color: 0x88aaff },
      { from: 0.8, to: -1.4, color: 0xffaa44 },
      { from: -1.8, to: 0.6, color: 0x44ffaa },
    ];

    for (const swing of SWINGS) {
      if (cancelled) return;
      pts.length = 0;
      const trailColor = swing.color;

      const state = { angle: swing.from };
      await animate(state, {
        angle: swing.to,
        duration: 380,
        ease: 'outCubic',
        onUpdate: () => {
          const tipX = cx + Math.cos(state.angle) * SWORD_LEN;
          const tipY = cy + Math.sin(state.angle) * SWORD_LEN;
          const baseX = cx + Math.cos(state.angle) * 6;
          const baseY = cy + Math.sin(state.angle) * 6;

          pts.push({ x: tipX, y: tipY });
          if (pts.length > MAX_POINTS) pts.shift();

          trail.clear();
          const poly = buildRibbonPolygon(pts, MAX_WIDTH);
          if (poly) {
            trail.poly(poly).fill({ color: trailColor, alpha: 0.65 });
            // Bright core line
            trail.moveTo(pts[0].x, pts[0].y);
            for (let si = 1; si < pts.length; si++) trail.lineTo(pts[si].x, pts[si].y);
            trail.stroke({ color: 0xffffff, width: 0.8, alpha: 0.3 });
          }

          drawSword(tipX, tipY, baseX, baseY);
        },
      });

      if (cancelled) return;

      // Trail fades out
      const fade = { a: 0.65 };
      await animate(fade, {
        a: 0,
        duration: 350,
        ease: 'outQuad',
        onUpdate: () => {
          trail.clear();
          const poly = buildRibbonPolygon(pts, MAX_WIDTH * fade.a * 1.5);
          if (poly && fade.a > 0.02) {
            trail.poly(poly).fill({ color: trailColor, alpha: fade.a });
          }
        },
      });
      if (cancelled) return;

      sword.clear();
      trail.clear();

      await new Promise<void>((res) => { timer = setTimeout(res, 200); });
    }

    await new Promise<void>((res) => { timer = setTimeout(res, 500); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    [bg, trail, sword, label].forEach((e) => e.destroy());
  };
}
