import { Graphics } from 'pixi.js';
import { defineSequence } from '../types';

export interface SwordSwingParams {
  cx: number;
  cy: number;
  swordLen?: number;
}

const MAX_POINTS = 28;
const MAX_WIDTH = 14;
const HANDLE_LEN = 10;

const SWINGS = [
  { from: -2.2, to: 0.4, color: 0x88aaff },
  { from: 0.8, to: -1.4, color: 0xffaa44 },
  { from: -1.8, to: 0.6, color: 0x44ffaa },
];

function buildRibbonPolygon(pts: { x: number; y: number }[], maxW: number): number[] | null {
  if (pts.length < 2) return null;
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
  return poly;
}

function drawSword(g: Graphics, tipX: number, tipY: number, baseX: number, baseY: number) {
  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / len) * 2;
  const ny = (dx / len) * 2;
  g.clear();
  g.moveTo(baseX, baseY).lineTo(tipX, tipY).stroke({ color: 0xddeeff, width: 2 });
  g.moveTo(baseX + nx, baseY + ny).lineTo(tipX + nx * 0.3, tipY + ny * 0.3).stroke({ color: 0xffffff, width: 0.8, alpha: 0.6 });
  g.moveTo(baseX - nx * 3, baseY - ny * 3).lineTo(baseX + nx * 3, baseY + ny * 3).stroke({ color: 0xaa8844, width: 2 });
  const hx = baseX - (dx / len) * HANDLE_LEN;
  const hy = baseY - (dy / len) * HANDLE_LEN;
  g.moveTo(baseX, baseY).lineTo(hx, hy).stroke({ color: 0x886633, width: 3 });
}

/**
 * Three-swing sword trail sequence using an anime.js timeline.
 * Each swing adds a tapered ribbon trail that fades after the blade passes.
 *
 * Seekable in the VFX debug panel — drag the slider to preview any swing.
 *
 * In-game usage:
 *   await vfx.play(swordSwing, { cx, cy });
 */
export const swordSwing = defineSequence<SwordSwingParams>({
  kind: 'sequence',
  id: 'swordSwing',
  async build({ cx, cy, swordLen = 38 }, { layer, timeline: getTimeline }) {
    const trail = new Graphics();
    layer.addChild(trail);
    const sword = new Graphics();
    layer.addChild(sword);

    const tl = getTimeline();
    let offset = 0;

    for (const swing of SWINGS) {
      const pts: { x: number; y: number }[] = [];
      const state = { angle: swing.from };
      const fade = { alpha: 0.65 };
      const swingColor = swing.color;

      tl.add(
        state,
        {
          angle: swing.to,
          duration: 380,
          ease: 'outCubic',
          onUpdate: () => {
            const tipX = cx + Math.cos(state.angle) * swordLen;
            const tipY = cy + Math.sin(state.angle) * swordLen;
            const baseX = cx + Math.cos(state.angle) * 6;
            const baseY = cy + Math.sin(state.angle) * 6;
            pts.push({ x: tipX, y: tipY });
            if (pts.length > MAX_POINTS) pts.shift();
            trail.clear();
            const poly = buildRibbonPolygon(pts, MAX_WIDTH);
            if (poly) {
              trail.poly(poly).fill({ color: swingColor, alpha: 0.65 });
              trail.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) trail.lineTo(pts[i].x, pts[i].y);
              trail.stroke({ color: 0xffffff, width: 0.8, alpha: 0.3 });
            }
            drawSword(sword, tipX, tipY, baseX, baseY);
          },
        },
        offset,
      );

      tl.add(
        fade,
        {
          alpha: 0,
          duration: 350,
          ease: 'outQuad',
          onUpdate: () => {
            trail.clear();
            const poly = buildRibbonPolygon(pts, MAX_WIDTH * fade.alpha * 1.5);
            if (poly && fade.alpha > 0.02) trail.poly(poly).fill({ color: swingColor, alpha: fade.alpha });
          },
          onComplete: () => { sword.clear(); trail.clear(); },
        },
        offset + 380,
      );

      offset += 930; // 380 swing + 350 fade + 200 inter-swing pause
    }

    await tl;
    trail.destroy();
    sword.destroy();
  },
});
