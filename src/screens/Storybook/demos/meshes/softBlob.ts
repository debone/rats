/**
 * MESH: Soft Body Blob
 *
 * A pressure-based soft body simulation. K boundary vertices form a circle,
 * connected by structural springs to their neighbours and radial springs to
 * a free-moving centre mass. A pressure term pushes vertices outward when
 * the enclosed polygon area falls below the rest area — giving the blob its
 * incompressible, jelly-like quality.
 *
 * The blob is rendered as a custom MeshGeometry triangle fan (centre + K
 * perimeter vertices) so the texture stretches with the deformation.
 *
 * Physics:
 *   Verlet integration (pos += pos - prev + acc * dt²)
 *   Structural springs (edge length constraint, K iterations)
 *   Radial springs (centre ↔ boundary)
 *   Pressure (area error → outward force on each boundary vertex)
 *   Wall/floor collisions with restitution
 *
 * The face (eyes + expression) is drawn in Graphics above the mesh and
 * tracks the mouse for an interactive, living feel.
 */
import { Container, Graphics, Mesh, MeshGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { demoMouse } from '../demoMouse';
import { app } from '@/main';

const K      = 20;    // boundary vertices
const R0     = 52;    // rest radius
const ITERS  = 10;    // constraint iterations per frame
const GRAVITY = 320;
const BOUNCE  = 0.55;
const EDGE_K  = 0.55;
const RADIAL_K = 0.3;
const PRESSURE_K = 0.65;

function restArea(r: number, k: number) {
  // Area of a regular k-gon with circumradius r
  return 0.5 * k * r * r * Math.sin((2 * Math.PI) / k);
}

function polyArea(bx: Float32Array, by: Float32Array): number {
  let a = 0;
  for (let i = 0; i < K; i++) {
    const j = (i + 1) % K;
    a += bx[i] * by[j] - bx[j] * by[i];
  }
  return Math.abs(a) * 0.5;
}

function makeBlobTex(): Texture {
  const g = new Graphics();
  const S = 128;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 2 - 1, v = (y / S) * 2 - 1;
      const r = Math.hypot(u, v);
      if (r > 1) continue;
      const t = Math.pow(1 - r, 0.7);
      const col = lerpHex(0x88ff44, 0x22cc00, r);
      g.rect(x, y, 1, 1).fill({ color: col, alpha: t });
    }
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function lerpHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) |
         (Math.round(ag + (bg - ag) * t) << 8)  |
          Math.round(ab + (bb - ab) * t);
}

export function softBlob(root: Container, w: number, h: number): () => void {
  const FLOOR = h - 16;
  const TARGET_AREA = restArea(R0, K);
  const REST_EDGE   = 2 * R0 * Math.sin(Math.PI / K);
  const REST_RADIAL = R0;

  const label = new Text({
    text: 'MESH: Soft body blob — pressure + spring physics. Verlet integration on K=20 boundary vertices. Click to throw.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x88ff44, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, h - 16).fill(0x060a04);
  root.addChild(bg);

  // Floor line
  const floor = new Graphics().rect(0, FLOOR - 1, w, 2).fill({ color: 0x336611, alpha: 0.5 });
  root.addChild(floor);

  // Blob state
  const bx = new Float32Array(K), by = new Float32Array(K);
  const ox = new Float32Array(K), oy = new Float32Array(K);
  let cx = w * 0.45, cy = h * 0.35;
  let ocx = cx, ocy = cy;

  for (let i = 0; i < K; i++) {
    const a = (i / K) * Math.PI * 2;
    bx[i] = ox[i] = cx + Math.cos(a) * R0;
    by[i] = oy[i] = cy + Math.sin(a) * R0;
  }

  // Build MeshGeometry: fan of K triangles
  const N_VERTS = K + 1;
  const positions = new Float32Array(N_VERTS * 2);
  const uvs       = new Float32Array(N_VERTS * 2);
  const idx       = new Uint32Array(K * 3);

  uvs[0] = 0.5; uvs[1] = 0.5;
  for (let i = 0; i < K; i++) {
    const a = (i / K) * Math.PI * 2;
    uvs[(i + 1) * 2]     = 0.5 + Math.cos(a) * 0.5;
    uvs[(i + 1) * 2 + 1] = 0.5 + Math.sin(a) * 0.5;
    idx[i * 3] = 0;
    idx[i * 3 + 1] = i + 1;
    idx[i * 3 + 2] = (i + 1) % K + 1;
  }

  const blobTex = makeBlobTex();
  const geo  = new MeshGeometry({ positions, uvs, indices: idx });
  const mesh = new Mesh({ geometry: geo, texture: blobTex });
  root.addChild(mesh);

  const { buffer: posBuf } = geo.getAttribute('aPosition');

  // Face drawn above mesh
  const face = new Container();
  const eyeL = new Graphics().circle(-12, -8, 7).fill(0xffffff).circle(-12, -8, 4).fill(0x112200);
  const eyeR = new Graphics().circle( 12, -8, 7).fill(0xffffff).circle( 12, -8, 4).fill(0x112200);
  const mouth = new Graphics().arc(0, 8, 10, 0.3, Math.PI - 0.3).stroke({ color: 0x112200, width: 2.5 });
  face.addChild(eyeL, eyeR, mouth);
  root.addChild(face);

  let mouseX = cx, mouseY = cy;
  const onMove = (e: MouseEvent) => { const m = demoMouse(e); mouseX = m.x; mouseY = m.y; };
  const onClick = (e: MouseEvent) => {
    const { x: mx, y: my } = demoMouse(e);
    const dx = cx - mx, dy = cy - my;
    const dist = Math.hypot(dx, dy) || 1;
    const imp = 180 / dist;
    for (let i = 0; i < K; i++) { ox[i] = bx[i] - dx * imp * 0.01; oy[i] = by[i] - dy * imp * 0.01; }
    ocx = cx - dx * imp * 0.009; ocy = cy - dy * imp * 0.009;
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('click', onClick);

  const tick = (dt: { deltaMS: number }) => {
    const s = Math.min(dt.deltaMS / 1000, 0.033);

    // Integrate boundary
    for (let i = 0; i < K; i++) {
      const vx = bx[i] - ox[i], vy = by[i] - oy[i];
      ox[i] = bx[i]; oy[i] = by[i];
      bx[i] += vx * 0.97;
      by[i] += vy * 0.97 + GRAVITY * s * s;
    }
    // Integrate centre
    const vcx = cx - ocx, vcy = cy - ocy;
    ocx = cx; ocy = cy;
    cx += vcx * 0.97;
    cy += vcy * 0.97 + GRAVITY * s * s;

    for (let iter = 0; iter < ITERS; iter++) {
      // Edge springs
      for (let i = 0; i < K; i++) {
        const j = (i + 1) % K;
        const dx = bx[j] - bx[i], dy = by[j] - by[i];
        const dist = Math.hypot(dx, dy) || 0.001;
        const corr = (dist - REST_EDGE) / dist * EDGE_K * 0.5;
        bx[i] += dx * corr; by[i] += dy * corr;
        bx[j] -= dx * corr; by[j] -= dy * corr;
      }
      // Radial springs
      for (let i = 0; i < K; i++) {
        const dx = bx[i] - cx, dy = by[i] - cy;
        const dist = Math.hypot(dx, dy) || 0.001;
        const corr = (dist - REST_RADIAL) / dist * RADIAL_K * 0.5;
        bx[i] -= dx * corr; by[i] -= dy * corr;
        cx += dx * corr * (1 / K); cy += dy * corr * (1 / K);
      }
      // Pressure
      const area = polyArea(bx, by);
      const pressErr = (TARGET_AREA - area) / TARGET_AREA * PRESSURE_K;
      for (let i = 0; i < K; i++) {
        const nx = bx[i] - cx, ny = by[i] - cy;
        const len = Math.hypot(nx, ny) || 1;
        bx[i] += (nx / len) * pressErr * R0 * 0.04;
        by[i] += (ny / len) * pressErr * R0 * 0.04;
      }
      // Floor collision
      for (let i = 0; i < K; i++) {
        if (by[i] > FLOOR) { by[i] = FLOOR; oy[i] = by[i] + (by[i] - oy[i]) * BOUNCE; }
      }
      if (cy > FLOOR - 6) { cy = FLOOR - 6; ocy = cy + (cy - ocy) * BOUNCE; }
      // Wall collision
      for (let i = 0; i < K; i++) {
        if (bx[i] < 4)     { bx[i] = 4;     ox[i] = bx[i] + (bx[i] - ox[i]) * BOUNCE; }
        if (bx[i] > w - 4) { bx[i] = w - 4; ox[i] = bx[i] + (bx[i] - ox[i]) * BOUNCE; }
      }
    }

    // Write to mesh
    posBuf.data[0] = cx; posBuf.data[1] = cy;
    for (let i = 0; i < K; i++) {
      posBuf.data[(i + 1) * 2]     = bx[i];
      posBuf.data[(i + 1) * 2 + 1] = by[i];
    }
    posBuf.update();

    // Face follows centre, eyes track mouse
    face.x = cx; face.y = cy;
    const edx = Math.max(-3, Math.min(3, (mouseX - cx) * 0.15));
    const edy = Math.max(-3, Math.min(3, (mouseY - cy) * 0.15));
    eyeL.children[1].position.set(-12 + edx, -8 + edy);
    eyeR.children[1].position.set( 12 + edx, -8 + edy);
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('click', onClick);
    app.ticker.remove(tick);
    blobTex.destroy(true);
    [label, bg, floor, mesh, face].forEach(e => e.destroy({ children: true }));
  };
}
