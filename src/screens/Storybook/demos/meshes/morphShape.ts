/**
 * MESH: Morphing Shape (MeshGeometry vertex interpolation)
 *
 * Custom MeshGeometry lets you define exactly which triangles to render and
 * their UV coordinates. No Sprite or Graphics API can interpolate between two
 * arbitrary polygon shapes: Graphics redraws from scratch every frame,
 * discarding topology. A MeshGeometry keeps its triangle fan constant and
 * lets you move the vertices — which is the key insight.
 *
 * This demo morphs between five shapes (circle, star, hexagon, cross, arrow)
 * by interpolating vertex positions while the triangle connectivity stays
 * unchanged. A smooth easing (smoothstep³) drives the t parameter.
 *
 * MeshGeometry API (PixiJS v8):
 *   new MeshGeometry({ positions, uvs, indices })
 *   positions: Float32Array [x0,y0, x1,y1, ...]
 *   uvs:       Float32Array [u0,v0, u1,v1, ...]  0..1
 *   indices:   Uint32Array  [i0,i1,i2, ...]       triangle list
 */
import { Container, Graphics, Mesh, MeshGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const N = 24;  // number of outer vertices in the polygon fan

function buildShape(fn: (i: number, n: number) => [number, number], scale: number): Float32Array {
  // [centre, ...N outer vertices]
  const pts = new Float32Array((N + 1) * 2);
  pts[0] = 0; pts[1] = 0;
  for (let i = 0; i < N; i++) {
    const [x, y] = fn(i, N);
    pts[(i + 1) * 2]     = x * scale;
    pts[(i + 1) * 2 + 1] = y * scale;
  }
  return pts;
}

const SCALE = 70;

const SHAPES: Float32Array[] = [
  // Circle
  buildShape((i, n) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  }, SCALE),
  // Star (5 points, alternating outer/inner)
  buildShape((i, n) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % (n / 5) < n / 10 ? 1.0 : 0.45;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, SCALE),
  // Hexagon
  buildShape((i, n) => {
    const a = (Math.floor(i / (n / 6) + 0.5) / 6) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  }, SCALE),
  // Cross (plus shape)
  buildShape((i, n) => {
    const a = (i / n) * Math.PI * 2;
    const seg = (i / n * 4) % 1;
    const r = seg < 0.2 || seg > 0.8 ? 1.0 : 0.38;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, SCALE),
  // Arrow (pointing right)
  buildShape((i, n) => {
    const a = (i / n) * Math.PI * 2;
    const ang = ((a + Math.PI * 2) % (Math.PI * 2));
    let r = 0.45;
    if (ang < Math.PI * 0.5 || ang > Math.PI * 1.5) r = 1.0;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, SCALE),
];

const NAMES = ['Circle', 'Star', 'Hexagon', 'Cross', 'Arrow'];

function makeGradTex(): Texture {
  const g = new Graphics();
  // Radial gradient approximation via concentric filled circles
  for (let r = SCALE; r > 0; r -= 2) {
    const t = 1 - r / SCALE;
    const col = (Math.round(0x22 + t * (0xaa - 0x22)) << 16) |
                (Math.round(0x44 + t * (0xcc - 0x44)) << 8) |
                Math.round(0xff - t * 0x88);
    g.circle(SCALE + 4, SCALE + 4, r).fill(col);
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function buildGeometry(positions: Float32Array): MeshGeometry {
  const uvs = new Float32Array((N + 1) * 2);
  uvs[0] = 0.5; uvs[1] = 0.5;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    uvs[(i + 1) * 2]     = 0.5 + Math.cos(a) * 0.5;
    uvs[(i + 1) * 2 + 1] = 0.5 + Math.sin(a) * 0.5;
  }
  const indices = new Uint32Array(N * 3);
  for (let i = 0; i < N; i++) {
    indices[i * 3]     = 0;
    indices[i * 3 + 1] = i + 1;
    indices[i * 3 + 2] = ((i + 1) % N) + 1;
  }
  return new MeshGeometry({ positions, uvs, indices });
}

export function morphShape(root: Container, w: number, h: number): () => void {
  const PREVIEW_H = h - 16;

  const label = new Text({
    text: 'MESH: MeshGeometry morph — same triangles, moving vertices. Click to advance shape.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0xffaa44, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, PREVIEW_H).fill(0x100808);
  root.addChild(bg);

  const gradTex = makeGradTex();

  // Start with a copy of SHAPES[0] as live positions
  const livePos = new Float32Array(SHAPES[0]);
  const geo = buildGeometry(livePos);
  const mesh = new Mesh({ geometry: geo, texture: gradTex });
  mesh.x = w / 2;
  mesh.y = 16 + PREVIEW_H / 2;
  root.addChild(mesh);

  const nameLabel = new Text({
    text: NAMES[0],
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, fill: 0xffffff },
  });
  nameLabel.anchor.set(0.5);
  nameLabel.x = w / 2;
  nameLabel.y = 16 + PREVIEW_H / 2 + SCALE + 16;
  root.addChild(nameLabel);

  const { buffer } = geo.getAttribute('aPosition');

  let fromIdx = 0, toIdx = 1;
  let morphT = 0;
  let morphing = true;

  const onClick = () => {
    fromIdx = toIdx;
    toIdx = (toIdx + 1) % SHAPES.length;
    morphT = 0;
    morphing = true;
  };
  window.addEventListener('click', onClick);

  const tick = (dt: { deltaMS: number }) => {
    if (!morphing) return;
    morphT += dt.deltaMS / 1000 / 0.8;
    if (morphT >= 1) { morphT = 1; morphing = false; }
    // Smoothstep³ easing
    const t = morphT * morphT * (3 - 2 * morphT);
    const t2 = t * t * (3 - 2 * t);

    const from = SHAPES[fromIdx];
    const to   = SHAPES[toIdx];
    for (let i = 0; i < (N + 1) * 2; i++) {
      buffer.data[i] = from[i] + (to[i] - from[i]) * t2;
    }
    buffer.update();
    nameLabel.text = morphing
      ? `${NAMES[fromIdx]} → ${NAMES[toIdx]}`
      : NAMES[toIdx];
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('click', onClick);
    app.ticker.remove(tick);
    gradTex.destroy(true);
    [label, bg, mesh, nameLabel].forEach(e => e.destroy({ children: true }));
  };
}
