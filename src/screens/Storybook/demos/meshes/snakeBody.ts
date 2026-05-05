/**
 * MESH: Snake Body (follow-the-leader MeshRope)
 *
 * MeshRope is particularly suited to articulated creatures: each segment
 * follows the one ahead of it at a fixed distance ("follow-the-leader").
 * The rope geometry handles perpendicular edge normals, UV continuity, and
 * texture scaling automatically — none of which is possible with plain Graphics.
 *
 * Segment following algorithm:
 *   for i from 1 to N-1:
 *     angle = atan2(seg[i].y - seg[i-1].y, seg[i].x - seg[i-1].x)
 *     seg[i].x = seg[i-1].x + cos(angle) * SEG_LEN
 *     seg[i].y = seg[i-1].y + sin(angle) * SEG_LEN
 *
 * The head chases the mouse at a capped speed (MAX_SPEED px/s).
 * A separate Graphics draws the head circle on top of the rope.
 *
 * textureScale=1 tiles the snake skin texture along the rope length so it
 * doesn't stretch as the snake moves.
 */
import { Container, Graphics, MeshRope, Point, Texture, Text } from 'pixi.js';
import { demoMouse } from '../demoMouse';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const SEGMENTS = 40;
const SEG_LEN = 9;
const MAX_SPEED = 180;

function makeSnakeTex(): Texture {
  const g = new Graphics();
  // Scales pattern: alternating green bands
  for (let x = 0; x < 128; x += 16) {
    g.rect(x, 0, 8, 32).fill({ color: 0x2d7a2d, alpha: 1 });
    g.rect(x + 8, 0, 8, 32).fill({ color: 0x1d5a1d, alpha: 1 });
  }
  // Belly highlight at V center
  g.rect(0, 10, 128, 12).fill({ color: 0x88cc44, alpha: 0.5 });
  // Edge feather (transparent at top/bottom)
  g.rect(0, 0, 128, 4).fill({ color: 0x000000, alpha: 0.6 });
  g.rect(0, 28, 128, 4).fill({ color: 0x000000, alpha: 0.6 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function snakeBody(root: Container, w: number, h: number): () => void {
  const PREVIEW_H = h - 16;
  const cx = w / 2, cy = 16 + PREVIEW_H / 2;

  const label = new Text({
    text: 'MESH: Snake body — follow-the-leader segments on MeshRope. Move mouse. UV tiles automatically.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x44cc44, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, PREVIEW_H).fill(0x0e1a0e);
  root.addChild(bg);

  // Scatter some food pellets
  const pellets: Graphics[] = [];
  for (let i = 0; i < 8; i++) {
    const p = new Graphics().circle(0, 0, 5).fill(0xffdd44);
    p.x = 30 + Math.random() * (w - 60);
    p.y = 26 + Math.random() * (PREVIEW_H - 20);
    bg.addChild(p);
    pellets.push(p);
  }

  const snakeTex = makeSnakeTex();

  // Segments stored as Point objects — MeshRope references these
  const segs = Array.from({ length: SEGMENTS }, (_, i) => new Point(cx - i * SEG_LEN, cy));

  const rope = new MeshRope({ texture: snakeTex, points: segs, textureScale: 1 });
  rope.tint = 0xeeffee;
  root.addChild(rope);

  // Head circle drawn above rope
  const headG = new Graphics();
  headG.circle(0, 0, 11).fill(0x2d7a2d);
  headG.circle(-3, -3, 3).fill(0xffffff);
  headG.circle(3, -3, 3).fill(0xffffff);
  headG.circle(-3, -3, 1).fill(0x000000);
  headG.circle(3, -3, 1).fill(0x000000);
  root.addChild(headG);

  let targetX = cx, targetY = cy;

  const onMove = (e: MouseEvent) => {
    const { x, y } = demoMouse(e);
    targetX = x; targetY = y;
  };
  window.addEventListener('mousemove', onMove);

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;

    // Move head toward mouse at capped speed
    const dx = targetX - segs[0].x;
    const dy = targetY - segs[0].y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = Math.min(dist / s, MAX_SPEED);
    segs[0].x += (dx / dist) * speed * s;
    segs[0].y += (dy / dist) * speed * s;

    // Clamp to preview area
    segs[0].x = Math.max(8, Math.min(w - 8, segs[0].x));
    segs[0].y = Math.max(24, Math.min(h - 8, segs[0].y));

    // Follow-the-leader for remaining segments
    for (let i = 1; i < SEGMENTS; i++) {
      const ddx = segs[i].x - segs[i - 1].x;
      const ddy = segs[i].y - segs[i - 1].y;
      const d = Math.hypot(ddx, ddy) || 1;
      segs[i].x = segs[i - 1].x + (ddx / d) * SEG_LEN;
      segs[i].y = segs[i - 1].y + (ddy / d) * SEG_LEN;
    }

    headG.x = segs[0].x;
    headG.y = segs[0].y;
    const angle = Math.atan2(segs[0].y - segs[1].y, segs[0].x - segs[1].x);
    headG.rotation = angle + Math.PI / 2;
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('mousemove', onMove);
    app.ticker.remove(tick);
    snakeTex.destroy(true);
    [label, bg, rope, headG].forEach(e => e.destroy({ children: true }));
  };
}
