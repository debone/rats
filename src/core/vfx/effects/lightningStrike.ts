import { Graphics } from 'pixi.js';
import { defineSequence } from '../types';

export interface LightningStrikeParams {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: number;
  duration?: number;
}

type Pt = { x: number; y: number };

function subdivide(pts: Pt[], roughness: number, depth: number): Pt[] {
  if (depth === 0) return pts;
  const result: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    result.push(pts[i]);
    const a = pts[i], b = pts[i + 1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const px = -dy / (len || 1), py = dx / (len || 1);
    const disp = (Math.random() - 0.5) * len * roughness;
    result.push({ x: mx + px * disp, y: my + py * disp });
  }
  result.push(pts[pts.length - 1]);
  return subdivide(result, roughness * 0.65, depth - 1);
}

function drawBolt(g: Graphics, pts: Pt[], alpha: number, width: number, color: number) {
  if (pts.length < 2) return;
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ color, width: width * 3, alpha: alpha * 0.18 });
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ color, width, alpha });
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ color: 0xffffff, width: width * 0.4, alpha: alpha * 0.7 });
}

/**
 * Single procedural lightning strike — recursive midpoint displacement.
 * Fire-and-forget: creates bolt geometry, animates flash+fade on ctx.stage,
 * and cleans up on completion.
 *
 * The screen-wide flash uses ctx.stage so it covers the full viewport.
 *
 * In-game usage:
 *   await vfx.play(lightningStrike, { x1, y1, x2, y2 });
 */
export const lightningStrike = defineSequence<LightningStrikeParams>({
  kind: 'sequence',
  id: 'lightningStrike',
  async build({ x1, y1, x2, y2, color = 0xaaccff, duration = 220 }, { layer, stage, timeline: getTimeline }) {
    const mainPts = subdivide([{ x: x1, y: y1 }, { x: x2, y: y2 }], 0.55, 5);

    const baseAngle = Math.atan2(y2 - y1, x2 - x1);
    const branches: Pt[][] = [];
    const branchCount = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < branchCount; b++) {
      const idx = Math.floor(mainPts.length * (0.3 + Math.random() * 0.4));
      if (idx >= mainPts.length) continue;
      const origin = mainPts[idx];
      const bLen = 30 + Math.random() * 50;
      const branchAngle = baseAngle + (Math.random() - 0.5) * 1.2;
      const bEnd = { x: origin.x + Math.cos(branchAngle) * bLen, y: origin.y + Math.sin(branchAngle) * bLen };
      branches.push(subdivide([origin, bEnd], 0.75, 4));
    }

    // Screen flash on stage (full-viewport); bolt on layer
    const flashG = new Graphics();
    stage.addChild(flashG);
    const boltG = new Graphics();
    layer.addChild(boltG);

    const state = { flash: 0.45, boltAlpha: 0 };
    const tl = getTimeline();

    // Flash decays fast (90ms); bolt ramps up then fades over the full duration
    tl.add(state, { flash: 0, duration: 90, ease: 'outExpo' }, 0);
    tl.add(
      state,
      {
        boltAlpha: [0, 1, 1, 0],
        duration,
        ease: 'linear',
        onUpdate: () => {
          flashG.clear();
          if (state.flash > 0.001) {
            flashG.rect(-9999, -9999, 99999, 99999).fill({ color: 0xffffff, alpha: state.flash });
          }
          boltG.clear();
          if (state.boltAlpha > 0.01) {
            drawBolt(boltG, mainPts, state.boltAlpha, 1.5, color);
            for (const bp of branches) drawBolt(boltG, bp, state.boltAlpha * 0.65, 0.9, color);
          }
        },
        onComplete: () => {
          flashG.clear();
          boltG.clear();
        },
      },
      0,
    );

    await tl;
    flashG.destroy();
    boltG.destroy();
  },
});
