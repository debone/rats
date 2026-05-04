/**
 * MESH: Ground Ripple (click-triggered expanding waves)
 *
 * Each mouse click spawns a circular ripple that expands outward across a
 * subdivided MeshPlane "floor". The Y displacement at each vertex is the sum
 * of all active ripples:
 *
 *   offset = A * sin(k*r - ω*t) * exp(-decay*t) / max(r, 1)
 *
 * where r is distance from click, k is spatial frequency, ω is angular speed,
 * and the exponential + 1/r envelope makes it decay naturally.
 *
 * A Sprite simply cannot do this — per-vertex Y offsets require mesh geometry.
 * The texture tiles horizontally (a stone/floor pattern) giving spatial context.
 */
import { Container, Graphics, Mesh, PlaneGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const COLS = 38;
const ROWS = 28;

function makeFloorTex(w: number, h: number): Texture {
  const g = new Graphics();
  g.rect(0, 0, w, h).fill(0x223344);
  const TS = 24;
  for (let row = 0; row * TS < h; row++) {
    for (let col = 0; col * TS < w; col++) {
      if ((row + col) % 2 === 0) {
        g.rect(col * TS, row * TS, TS, TS).fill({ color: 0x334455, alpha: 1 });
      }
      g.rect(col * TS, row * TS, TS, 1).fill({ color: 0x445566, alpha: 0.5 });
      g.rect(col * TS, row * TS, 1, TS).fill({ color: 0x445566, alpha: 0.5 });
    }
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

interface Ripple {
  cx: number;  // click position in vertex-space
  cy: number;
  age: number;
}

export function groundRipple(root: Container, w: number, h: number): () => void {
  const PREVIEW_H = h - 16;

  const label = new Text({
    text: 'MESH: Ground ripple — click to spawn waves. Sum of sin(k·r−ω·t)/r per vertex. Mesh-exclusive.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x44ddaa, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, PREVIEW_H).fill(0x0a1520);
  root.addChild(bg);

  const floorTex = makeFloorTex(w, PREVIEW_H);
  const geo = new PlaneGeometry({ width: w, height: PREVIEW_H, verticesX: COLS, verticesY: ROWS });
  const plane = new Mesh({ geometry: geo, texture: floorTex });
  plane.y = 16;
  root.addChild(plane);

  const { buffer } = (plane.geometry as PlaneGeometry).getAttribute('aPosition');

  // Store rest X positions (Y will be displaced, X stays fixed)
  const restX = new Float32Array(COLS * ROWS);
  const restY = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    restX[i] = buffer.data[i * 2];
    restY[i] = buffer.data[i * 2 + 1];
  }

  const ripples: Ripple[] = [];

  const onClick = (e: MouseEvent) => {
    const bounds = app.canvas.getBoundingClientRect();
    const mx = (e.clientX - bounds.left) * (w / bounds.width);
    const my = (e.clientY - bounds.top) * (h / bounds.height) - 16;
    if (my < 0 || my > PREVIEW_H) return;
    ripples.push({ cx: mx, cy: my, age: 0 });
    if (ripples.length > 6) ripples.shift();
  };
  window.addEventListener('click', onClick);

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;
    for (const r of ripples) r.age += s;
    // Remove fully decayed ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      if (ripples[i].age > 3.5) ripples.splice(i, 1);
    }

    for (let vi = 0; vi < COLS * ROWS; vi++) {
      const vx = restX[vi];
      const vy = restY[vi];
      let dy = 0;
      for (const rip of ripples) {
        const dx = vx - rip.cx;
        const ddY = vy - rip.cy;
        const r = Math.hypot(dx, ddY);
        const decay = Math.exp(-rip.age * 2.2);
        const wave = Math.sin(r * 0.18 - rip.age * 8) * decay;
        dy += wave * 12 / Math.max(r * 0.08, 1);
      }
      buffer.data[vi * 2]     = vx;
      buffer.data[vi * 2 + 1] = vy + dy;
    }
    buffer.update();
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('click', onClick);
    app.ticker.remove(tick);
    floorTex.destroy(true);
    [label, bg, plane].forEach(e => e.destroy({ children: true }));
  };
}
