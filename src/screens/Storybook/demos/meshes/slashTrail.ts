/**
 * MESH: Slash Trail (Action Game VFX)
 *
 * Click and drag to draw a glowing slash arc. On mouse release the arc
 * freezes and fades over ~0.8s. Up to 5 slashes overlap simultaneously.
 *
 * Each slash is a MeshRope with:
 *  - Points from the gesture path (sampled at screen rate, then thinned)
 *  - A hot-core texture: white centre, colour halo, transparent edges
 *  - textureScale=0 (stretch) so the glow fills the whole arc evenly
 *
 * Speed-based colouring: slow drag = cold blue-violet,
 * fast drag = hot white-yellow. The colour is baked into the tint.
 *
 * Cannot be replicated with Graphics.drawPolygon: Graphics has no UV
 * cross-section glow and cannot represent multiple independent fading
 * arcs efficiently in the same draw call.
 */
import { Container, Graphics, MeshRope, Point, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { demoMouse } from '../demoMouse';
import { app } from '@/main';

const MAX_SLASHES = 5;
const FADE_TIME   = 0.85;

function makeSlashTex(): Texture {
  const W = 128, H = 24;
  const g = new Graphics();
  for (let y = 0; y < H; y++) {
    const v = Math.abs(y / H * 2 - 1);           // 0 centre, 1 edge
    const alpha = Math.pow(Math.max(0, 1 - v), 1.6);
    // Core colour blends white→violet from centre to edge
    const t = v;
    const r = Math.round(lerp(0xff, 0xcc, t));
    const gg = Math.round(lerp(0xff, 0x44, t));
    const b = 0xff;
    g.rect(0, y, W, 1).fill({ color: (r << 16) | (gg << 8) | b, alpha });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface Slash {
  pts: Point[];
  rope: MeshRope;
  age: number;
  done: boolean;
}

export function slashTrail(root: Container, w: number, h: number): () => void {
  const label = new Text({
    text: 'MESH: Slash trail — click+drag to slash. Speed → colour (cold=slow, hot=fast). Each arc fades independently.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0xdd88ff, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, h - 16).fill(0x060408);
  root.addChild(bg);

  // Dim grid for spatial reference
  const grid = new Graphics();
  for (let x = 0; x < w; x += 40) grid.moveTo(x, 16).lineTo(x, h).stroke({ color: 0x1a0a2e, width: 1 });
  for (let y = 16; y < h; y += 40) grid.moveTo(0, y).lineTo(w, y).stroke({ color: 0x1a0a2e, width: 1 });
  root.addChild(grid);

  const slashTex = makeSlashTex();
  const slashes: Slash[] = [];
  const ropeLayer = new Container();
  root.addChild(ropeLayer);

  let dragging   = false;
  let rawPts: { x: number; y: number; t: number }[] = [];
  let lastPt = { x: 0, y: 0 };

  const onDown = (e: MouseEvent) => {
    const { x, y } = demoMouse(e);
    dragging = true;
    rawPts = [{ x, y, t: performance.now() }];
    lastPt = { x, y };
  };

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const { x, y } = demoMouse(e);
    const dist = Math.hypot(x - lastPt.x, y - lastPt.y);
    if (dist > 4) {
      rawPts.push({ x, y, t: performance.now() });
      lastPt = { x, y };
    }
  };

  const onUp = () => {
    if (!dragging || rawPts.length < 2) { dragging = false; rawPts = []; return; }
    dragging = false;

    // Measure speed (px/ms)
    const duration = rawPts[rawPts.length - 1].t - rawPts[0].t;
    let totalDist = 0;
    for (let i = 1; i < rawPts.length; i++) {
      totalDist += Math.hypot(rawPts[i].x - rawPts[i - 1].x, rawPts[i].y - rawPts[i - 1].y);
    }
    const speed = duration > 0 ? totalDist / duration : 0;  // px/ms

    // Speed-based colour: 0=slow blue-violet, 1=fast hot yellow-white
    const s01 = Math.min(speed / 1.5, 1);
    const tint = lerpHex(0x6622cc, 0xffffaa, s01);

    // Thin the point list to ~20 pts max
    const step = Math.max(1, Math.floor(rawPts.length / 20));
    const pts = rawPts.filter((_, i) => i % step === 0 || i === rawPts.length - 1);
    if (pts.length < 2) return;

    const ropePoints = pts.map(p => new Point(p.x, p.y));
    const rope = new MeshRope({ texture: slashTex, points: ropePoints });
    rope.tint = tint;
    ropeLayer.addChild(rope);

    slashes.push({ pts: ropePoints, rope, age: 0, done: true });
    if (slashes.length > MAX_SLASHES) {
      const old = slashes.shift()!;
      old.rope.destroy();
    }
    rawPts = [];
  };

  window.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onUp);

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;
    for (const slash of slashes) {
      slash.age += s;
      slash.rope.alpha = Math.max(0, 1 - slash.age / FADE_TIME);
    }
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup',   onUp);
    app.ticker.remove(tick);
    slashTex.destroy(true);
    [label, bg, grid, ropeLayer].forEach(e => e.destroy({ children: true }));
  };
}

function lerpHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) |
         (Math.round(ag + (bg - ag) * t) << 8)  |
          Math.round(ab + (bb - ab) * t);
}
