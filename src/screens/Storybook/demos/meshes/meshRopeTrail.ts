/**
 * MESH: MeshRope Trail
 *
 * MeshRope renders a textured ribbon along an array of PointData objects.
 * It automatically computes perpendicular edge vertices from the tangent at
 * each point, maps U=0→1 along the length, and handles all the quad math.
 *
 * Just update points[i].x / points[i].y each frame — autoUpdate:true
 * (default) rebuilds the geometry without extra calls.
 *
 * Compare to swordTrail.ts and ribbonTrail.ts, which manually compute
 * edge offsets using Graphics. That approach loses UV continuity at bends
 * and requires significant geometry code. MeshRope does it correctly for free.
 *
 * Width is the rope's cross-section thickness (set at construction).
 * textureScale > 0 preserves texture aspect ratio and tiles it; 0 stretches.
 */
import { Container, Graphics, MeshRope, Point, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const SEGMENTS = 52;

function makeRopeTex(): Texture {
  const g = new Graphics();
  // V axis = cross-section of rope: transparent at edges, opaque at centre
  for (let y = 0; y < 32; y++) {
    const t = 1 - Math.abs(y / 16 - 1); // 0→1→0
    g.rect(0, y, 128, 1).fill({ color: 0xffffff, alpha: t * t * t });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function meshRopeTrail(root: Container, w: number, h: number): () => void {
  const label = new Text({
    text: 'MESH: MeshRope — textured ribbon from point history. Auto UV + edge normals. No manual quad math.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x5533aa, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, h - 16).fill(0x050510);
  root.addChild(bg);

  const ropeTex = makeRopeTex();

  // Ball state
  let bx = w * 0.35, by = h * 0.5;
  let vx = 155, vy = -195;

  // All points start at ball position — rope "collapses" to a point then unfolds
  const points = Array.from({ length: SEGMENTS }, () => new Point(bx, by));

  const rope = new MeshRope({ texture: ropeTex, points });
  rope.tint = 0xaa55ff;
  root.addChild(rope);

  // Head ball drawn above the rope
  const ballG = new Graphics();
  ballG.circle(0, 0, 8).fill(0xffffff);
  ballG.circle(0, 0, 5).fill(0xddaaff);
  root.addChild(ballG);

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;
    vy += 240 * s;
    bx += vx * s;
    by += vy * s;

    if (bx < 8)     { bx = 8;     vx =  Math.abs(vx); }
    if (bx > w - 8) { bx = w - 8; vx = -Math.abs(vx); }
    if (by < 24)    { by = 24;    vy =  Math.abs(vy) * 0.86; }
    if (by > h - 8) { by = h - 8; vy = -Math.abs(vy) * 0.86; }

    // Shift history toward tail, insert new head
    for (let i = SEGMENTS - 1; i > 0; i--) {
      points[i].x = points[i - 1].x;
      points[i].y = points[i - 1].y;
    }
    points[0].x = bx;
    points[0].y = by;

    ballG.x = bx;
    ballG.y = by;
  };

  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    ropeTex.destroy(true);
    [label, bg, rope, ballG].forEach(e => e.destroy({ children: true }));
  };
}
