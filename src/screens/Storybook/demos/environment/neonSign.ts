/**
 * ENVIRONMENT: Neon Sign
 *
 * Neon glow is three stacked stroke passes on the same path:
 * 1. Wide (width=12), very low alpha — outer diffuse
 * 2. Medium (width=5), medium alpha — tube body
 * 3. Thin (width=1.5), high alpha — hot bright core
 *
 * Flicker state machine:
 *   STABLE → (random ~4s) → FLICKER (rapid on/off over 200ms) → STABLE
 * Each tube has its own timer so they don't all flicker together.
 *
 * Brick wall: rows of rounded rects with mortar gaps — a classic
 * environment background technique that takes 30 lines and reads instantly.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface Tube {
  path: { x: number; y: number }[];
  color: number;
  alpha: number;
  flickerTime: number;
  flickerDuration: number;
  nextFlicker: number;
  isFlickering: boolean;
  rapidState: boolean;
  rapidTimer: number;
}

function drawTube(g: Graphics, tube: Tube) {
  if (tube.path.length < 2) return;
  const a = tube.alpha;
  if (a <= 0) return;

  // Three pass glow
  g.moveTo(tube.path[0].x, tube.path[0].y);
  for (let i = 1; i < tube.path.length; i++) g.lineTo(tube.path[i].x, tube.path[i].y);
  g.stroke({ color: tube.color, width: 14, alpha: a * 0.08 });

  g.moveTo(tube.path[0].x, tube.path[0].y);
  for (let i = 1; i < tube.path.length; i++) g.lineTo(tube.path[i].x, tube.path[i].y);
  g.stroke({ color: tube.color, width: 5, alpha: a * 0.55 });

  g.moveTo(tube.path[0].x, tube.path[0].y);
  for (let i = 1; i < tube.path.length; i++) g.lineTo(tube.path[i].x, tube.path[i].y);
  g.stroke({ color: 0xffffff, width: 1.5, alpha: a * 0.9 });

  // End caps glow
  const first = tube.path[0];
  const last  = tube.path[tube.path.length - 1];
  g.circle(first.x, first.y, 4).fill({ color: tube.color, alpha: a * 0.3 });
  g.circle(last.x,  last.y,  4).fill({ color: tube.color, alpha: a * 0.3 });
}

// Build letter paths for "RATS" as stroke segments
function makeLetterPaths(cx: number, cy: number, scale: number): { path: { x: number; y: number }[]; color: number }[] {
  const s = scale;
  const tubes: { path: { x: number; y: number }[]; color: number }[] = [];

  // R — two vertical strokes + bump
  const rx = cx - s * 30;
  tubes.push({ color: 0xff44cc, path: [{ x: rx,      y: cy - s*12 }, { x: rx,      y: cy + s*12 }] }); // left vert
  tubes.push({ color: 0xff44cc, path: [{ x: rx,      y: cy - s*12 }, { x: rx+s*10, y: cy - s*12 },
                                         { x: rx+s*10, y: cy },        { x: rx,      y: cy }] }); // bump top
  tubes.push({ color: 0xff44cc, path: [{ x: rx,      y: cy }, { x: rx+s*12, y: cy+s*12 }] }); // leg

  // A
  const ax = cx - s * 10;
  tubes.push({ color: 0x44ccff, path: [{ x: ax,       y: cy + s*12 }, { x: ax+s*8,  y: cy - s*12 },
                                         { x: ax+s*16,  y: cy + s*12 }] }); // outline
  tubes.push({ color: 0x44ccff, path: [{ x: ax+s*4,   y: cy + s*2 }, { x: ax+s*12, y: cy + s*2 }] }); // crossbar

  // T
  const tx = cx + s * 14;
  tubes.push({ color: 0xffcc44, path: [{ x: tx,       y: cy - s*12 }, { x: tx+s*16, y: cy - s*12 }] }); // top
  tubes.push({ color: 0xffcc44, path: [{ x: tx+s*8,   y: cy - s*12 }, { x: tx+s*8,  y: cy + s*12 }] }); // stem

  // S
  const sx = cx + s * 38;
  tubes.push({ color: 0x44ff88, path: [{ x: sx+s*10, y: cy - s*12 }, { x: sx,       y: cy - s*12 },
                                         { x: sx,       y: cy },        { x: sx+s*10,  y: cy },
                                         { x: sx+s*10,  y: cy + s*12 }, { x: sx,       y: cy + s*12 }] });

  return tubes;
}

export function neonSign(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let time = 0;

  // ─── Brick wall ───────────────────────────────────────────────────────
  const wall = new Graphics();
  wall.rect(0, 0, w, h).fill(0x100a08);
  const brickH = 14, brickW = 32;
  for (let row = 0; row * brickH < h; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col * brickW < w + brickW; col++) {
      const bx = col * brickW + offset;
      const by = row * brickH;
      wall.roundRect(bx + 1, by + 1, brickW - 2, brickH - 2, 1)
        .fill({ color: 0x1e0e08, alpha: 0.9 });
    }
  }
  root.addChild(wall);

  // Sign backing board
  const board = new Graphics();
  const brdX = w * 0.08, brdY = h * 0.28, brdW = w * 0.84, brdH = h * 0.44;
  board.roundRect(brdX, brdY, brdW, brdH, 4).fill({ color: 0x06040a, alpha: 0.88 });
  board.roundRect(brdX, brdY, brdW, brdH, 4).stroke({ color: 0x331122, width: 1 });
  root.addChild(board);

  // Mounting bolts
  const bolts = new Graphics();
  [[brdX + 10, brdY + 10], [brdX + brdW - 10, brdY + 10],
   [brdX + 10, brdY + brdH - 10], [brdX + brdW - 10, brdY + brdH - 10]].forEach(([bx, by]) => {
    bolts.circle(bx, by, 3).fill(0x2a2020);
    bolts.circle(bx, by, 3).stroke({ color: 0x441122, width: 0.5 });
  });
  root.addChild(bolts);

  // ─── Neon tubes ───────────────────────────────────────────────────────
  const neonG = new Graphics();
  root.addChild(neonG);

  const rawPaths = makeLetterPaths(w / 2, h / 2, w / 120);
  const tubes: Tube[] = rawPaths.map((p) => ({
    ...p,
    alpha: 1,
    flickerTime: 0,
    flickerDuration: 200 + Math.random() * 150,
    nextFlicker: 2000 + Math.random() * 4000,
    isFlickering: false,
    rapidState: true,
    rapidTimer: 0,
  }));

  const label = new Text({
    text: 'ENV: NEON SIGN — 3-pass stroke glow + per-tube flicker state machine',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a1a3a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    time += dt.deltaMS;

    neonG.clear();

    for (const tube of tubes) {
      if (tube.isFlickering) {
        tube.flickerTime += dt.deltaMS;
        tube.rapidTimer  += dt.deltaMS;

        // Rapid on/off every 40–80ms
        if (tube.rapidTimer > 40 + Math.random() * 40) {
          tube.rapidState = !tube.rapidState;
          tube.rapidTimer = 0;
        }
        tube.alpha = tube.rapidState ? 1 : 0;

        if (tube.flickerTime >= tube.flickerDuration) {
          tube.isFlickering = false;
          tube.alpha = 1;
          tube.nextFlicker = 2500 + Math.random() * 5000;
        }
      } else {
        tube.nextFlicker -= dt.deltaMS;
        if (tube.nextFlicker <= 0) {
          tube.isFlickering = true;
          tube.flickerTime = 0;
          tube.flickerDuration = 120 + Math.random() * 200;
          tube.rapidState = false;
        }
        // Subtle breathing when stable
        tube.alpha = 0.88 + Math.sin(time * 0.002 + tubes.indexOf(tube) * 0.8) * 0.08;
      }

      drawTube(neonG, tube);
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    [wall, board, bolts, neonG, label].forEach((e) => e.destroy());
  };
}
