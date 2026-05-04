/**
 * MESH: Cloth Simulation (Verlet + MeshPlane)
 *
 * This is only possible with a mesh. A Sprite or Graphics cannot deform its
 * pixels — vertex manipulation is exclusive to Mesh types.
 *
 * Algorithm: Position-Based Verlet integration on a 2-D grid of particles.
 *   1. Integrate velocity: pos += (pos - prevPos) + gravity * dt²
 *   2. Satisfy constraints: for each structural spring, pull both endpoints
 *      toward each other so the edge length returns to rest length.
 *   3. Pin the top row in place.
 *   4. Write particle (x, y) into aPosition buffer → buffer.update().
 *
 * Constraint iterations (ITERS=8) trade accuracy for speed. More iterations
 * → stiffer cloth. Wind adds a sine-wave horizontal force to non-pinned nodes.
 */
import { Container, Graphics, Mesh, PlaneGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const COLS = 14;
const ROWS = 12;
const REST = 16;        // rest length between adjacent particles
const GRAVITY = 380;
const ITERS = 8;
const CLOTH_W = (COLS - 1) * REST;
const CLOTH_H = (ROWS - 1) * REST;

function makeClothTex(): Texture {
  const g = new Graphics();
  g.rect(0, 0, CLOTH_W, CLOTH_H).fill(0x334477);
  // Grid lines baked into texture for visual reference
  for (let c = 0; c <= COLS - 1; c++) {
    const x = (c / (COLS - 1)) * CLOTH_W;
    g.rect(x - 0.5, 0, 1, CLOTH_H).fill({ color: 0x6688aa, alpha: 0.4 });
  }
  for (let r = 0; r <= ROWS - 1; r++) {
    const y = (r / (ROWS - 1)) * CLOTH_H;
    g.rect(0, y - 0.5, CLOTH_W, 1).fill({ color: 0x6688aa, alpha: 0.4 });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function clothSim(root: Container, w: number, h: number): () => void {
  const label = new Text({
    text: 'MESH: Cloth sim — Verlet physics on MeshPlane vertices. Impossible with Sprite/Graphics.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x66aaff, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, h - 16).fill(0x060a14);
  root.addChild(bg);

  // Particle state
  const N = COLS * ROWS;
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const ox = new Float32Array(N);  // previous position
  const oy = new Float32Array(N);
  const pinned = new Uint8Array(N);

  const startX = (w - CLOTH_W) / 2;
  const startY = 28;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      px[i] = ox[i] = startX + c * REST;
      py[i] = oy[i] = startY + r * REST;
      if (r === 0) pinned[i] = 1;
    }
  }

  // Structural constraints: horizontal + vertical neighbours
  const constraints: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) constraints.push([r * COLS + c, r * COLS + c + 1]);
      if (r < ROWS - 1) constraints.push([r * COLS + c, (r + 1) * COLS + c]);
    }
  }

  const tex = makeClothTex();
  const geo = new PlaneGeometry({ width: CLOTH_W, height: CLOTH_H, verticesX: COLS, verticesY: ROWS });
  const plane = new Mesh({ geometry: geo, texture: tex });
  plane.x = startX;
  plane.y = startY;
  root.addChild(plane);

  const { buffer } = (plane.geometry as PlaneGeometry).getAttribute('aPosition');

  // Mouse drag
  let dragIdx = -1;
  let mouseX = 0, mouseY = 0;
  const onDown = (e: MouseEvent) => {
    const bounds = app.canvas.getBoundingClientRect();
    const mx = (e.clientX - bounds.left) * (w / bounds.width);
    const my = (e.clientY - bounds.top) * (h / bounds.height);
    let best = 400, bi = -1;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(px[i] - mx, py[i] - my);
      if (d < best) { best = d; bi = i; }
    }
    if (best < 24) { dragIdx = bi; mouseX = mx; mouseY = my; }
  };
  const onMove = (e: MouseEvent) => {
    const bounds = app.canvas.getBoundingClientRect();
    mouseX = (e.clientX - bounds.left) * (w / bounds.width);
    mouseY = (e.clientY - bounds.top) * (h / bounds.height);
  };
  const onUp = () => { dragIdx = -1; };
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  let t = 0;

  const tick = (dt: { deltaMS: number }) => {
    const s = Math.min(dt.deltaMS / 1000, 0.033);
    t += s;
    const wind = Math.sin(t * 0.9) * 60 + Math.sin(t * 2.3) * 20;

    // Verlet integrate
    for (let i = 0; i < N; i++) {
      if (pinned[i]) continue;
      if (i === dragIdx) {
        ox[i] = px[i]; oy[i] = py[i];
        px[i] = mouseX; py[i] = mouseY;
        continue;
      }
      const vx = px[i] - ox[i];
      const vy = py[i] - oy[i];
      ox[i] = px[i]; oy[i] = py[i];
      px[i] += vx * 0.98 + wind * s * s;
      py[i] += vy * 0.98 + GRAVITY * s * s;
    }

    // Satisfy constraints
    for (let iter = 0; iter < ITERS; iter++) {
      for (const [a, b] of constraints) {
        const dx = px[b] - px[a];
        const dy = py[b] - py[a];
        const dist = Math.hypot(dx, dy) || 0.001;
        const corr = (dist - REST) / dist * 0.5;
        if (!pinned[a]) { px[a] += dx * corr; py[a] += dy * corr; }
        if (!pinned[b]) { px[b] -= dx * corr; py[b] -= dy * corr; }
      }
    }

    // Write to mesh
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        buffer.data[i * 2]     = px[i] - startX;
        buffer.data[i * 2 + 1] = py[i] - startY;
      }
    }
    buffer.update();
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    app.ticker.remove(tick);
    tex.destroy(true);
    [label, bg, plane].forEach(e => e.destroy({ children: true }));
  };
}
