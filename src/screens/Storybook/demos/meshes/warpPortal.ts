/**
 * MESH: Warp Portal Vortex
 *
 * A spinning portal built from custom MeshGeometry arranged as concentric
 * rings. Inner rings rotate faster than outer ones (angular velocity ∝ 1/r),
 * creating the characteristic vortex whirlpool look.
 *
 * The key technique: vertex POSITIONS rotate (changing geometry each frame),
 * while UV coordinates are fixed relative to each vertex's rest angle. The
 * texture is a radial gradient. As vertices rotate, the texture appears to
 * spin — because each vertex always samples the same U coordinate but the
 * physical position changes.
 *
 * A secondary UV scroll (offsetting U by time) adds a depth-pull effect.
 *
 * Stars spiral inward from the rim and vanish at the centre — drawn with
 * Graphics each frame, not particles, because their paths follow the vortex
 * rotation analytically.
 */
import { Container, Graphics, Mesh, MeshGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const N_RINGS = 10;
const N_SEGS  = 32;
const MAX_R   = 110;

function makePortalTex(): Texture {
  const SIZE = 256;
  const g = new Graphics();
  // Spiral-stripe pattern: bright and dark bands along U axis (angle)
  for (let u = 0; u < SIZE; u++) {
    const stripe = Math.sin(u / SIZE * Math.PI * 12);
    const bright = 0.5 + stripe * 0.3;
    for (let v = 0; v < SIZE; v++) {
      const radial = v / SIZE;  // 0=center, 1=edge
      const alpha = Math.pow(1 - radial, 0.8);
      const r = Math.round(lerp(0x00, 0x44, radial) + bright * lerp(0xcc, 0x22, radial));
      const gg = Math.round(lerp(0x00, 0x11, radial) + bright * lerp(0x88, 0x00, radial));
      const b = Math.round(lerp(0xff, 0x44, radial) + bright * lerp(0x44, 0x22, radial));
      g.rect(u, v, 1, 1).fill({ color: clamp3(r, gg, b), alpha: alpha * 0.95 });
    }
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp3(r: number, g: number, b: number) {
  return (Math.min(255, Math.max(0, r)) << 16) | (Math.min(255, Math.max(0, g)) << 8) | Math.min(255, Math.max(0, b));
}

export function warpPortal(root: Container, w: number, h: number): () => void {
  const cx = w / 2, cy = h / 2 + 8;

  const label = new Text({
    text: 'MESH: Warp portal — concentric ring geometry rotates (inner faster). Custom MeshGeometry with UV scroll.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0xaa77ff, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  const bg = new Graphics().rect(0, 16, w, h - 16).fill(0x04020a);
  root.addChild(bg);

  // Build ring geometry: one triangle strip per ring, fan into center
  // Vertex layout: N_RINGS+1 radii, each with N_SEGS vertices
  // Total verts: (N_RINGS+1) * N_SEGS + 1 (center)
  const N_VERTS = (N_RINGS + 1) * N_SEGS + 1;
  const positions = new Float32Array(N_VERTS * 2);
  const uvs       = new Float32Array(N_VERTS * 2);
  const indices: number[] = [];

  // Center vertex
  positions[0] = 0; positions[1] = 0;
  uvs[0] = 0.5; uvs[1] = 0.0;  // radial center, V=0

  // Ring vertices
  for (let ring = 0; ring <= N_RINGS; ring++) {
    const r = (ring / N_RINGS) * MAX_R;
    for (let seg = 0; seg < N_SEGS; seg++) {
      const idx = 1 + ring * N_SEGS + seg;
      const angle = (seg / N_SEGS) * Math.PI * 2;
      positions[idx * 2]     = Math.cos(angle) * r;
      positions[idx * 2 + 1] = Math.sin(angle) * r;
      uvs[idx * 2]     = seg / N_SEGS;           // U = angle/2π
      uvs[idx * 2 + 1] = ring / N_RINGS;         // V = radius ratio
    }
  }

  // Triangles: strip between adjacent rings
  for (let ring = 0; ring < N_RINGS; ring++) {
    for (let seg = 0; seg < N_SEGS; seg++) {
      const a = 1 + ring * N_SEGS + seg;
      const b = 1 + ring * N_SEGS + (seg + 1) % N_SEGS;
      const c = 1 + (ring + 1) * N_SEGS + seg;
      const d = 1 + (ring + 1) * N_SEGS + (seg + 1) % N_SEGS;
      indices.push(a, b, c,  b, d, c);
    }
  }
  // Center ring (ring=0 to center vertex)
  for (let seg = 0; seg < N_SEGS; seg++) {
    indices.push(0, 1 + seg, 1 + (seg + 1) % N_SEGS);
  }

  const portalTex = makePortalTex();
  const geo  = new MeshGeometry({ positions, uvs, indices: new Uint32Array(indices) });
  const mesh = new Mesh({ geometry: geo, texture: portalTex });
  mesh.x = cx; mesh.y = cy;
  root.addChild(mesh);

  const { buffer: posBuf } = geo.getAttribute('aPosition');
  const { buffer: uvBuf  } = geo.getAttribute('aTexCoord');

  // Cache rest angles and radii
  const restR: number[] = [0];
  const restA: number[] = [0];
  for (let ring = 0; ring <= N_RINGS; ring++) {
    const r = (ring / N_RINGS) * MAX_R;
    for (let seg = 0; seg < N_SEGS; seg++) {
      restR.push(r);
      restA.push((seg / N_SEGS) * Math.PI * 2);
    }
  }

  // Outer glow ring
  const outerGlow = new Graphics();
  outerGlow.circle(0, 0, MAX_R + 8).fill({ color: 0x6600ff, alpha: 0 });
  outerGlow.circle(0, 0, MAX_R + 8).stroke({ color: 0x9944ff, width: 4, alpha: 0.7 });
  outerGlow.x = cx; outerGlow.y = cy;
  root.addChild(outerGlow);

  // Spiral star particles
  interface Star { angle: number; radius: number; speed: number; }
  const stars: Star[] = Array.from({ length: 24 }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: MAX_R * (0.3 + Math.random() * 0.7),
    speed: 0.8 + Math.random() * 1.2,
  }));
  const starLayer = new Graphics();
  starLayer.x = cx; starLayer.y = cy;
  root.addChild(starLayer);

  let time = 0;

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;
    time += s;

    // Rotate rings: inner faster (1/r²-ish speed)
    for (let vi = 0; vi < N_VERTS; vi++) {
      if (vi === 0) continue;
      const r = restR[vi];
      const baseAngle = restA[vi];
      const angSpeed = r < 1 ? 0 : 2.2 / (r / MAX_R + 0.08);
      const angle = baseAngle + time * angSpeed;
      posBuf.data[vi * 2]     = Math.cos(angle) * r;
      posBuf.data[vi * 2 + 1] = Math.sin(angle) * r;
      // UV scroll in U (pulls texture inward)
      uvBuf.data[vi * 2] = (vi === 0 ? 0.5 : (angle / (Math.PI * 2)) % 1);
    }
    posBuf.update();
    uvBuf.update();

    // Pulse outer glow
    outerGlow.alpha = 0.6 + 0.4 * Math.sin(time * 3.1);
    outerGlow.scale.set(1 + 0.04 * Math.sin(time * 4.7));

    // Spiral stars inward
    starLayer.clear();
    for (const star of stars) {
      star.angle += star.speed * s * (1 + 2 / (star.radius / MAX_R + 0.1));
      star.radius -= star.speed * s * 18;
      if (star.radius < 4) {
        star.radius = MAX_R * (0.5 + Math.random() * 0.5);
        star.angle  = Math.random() * Math.PI * 2;
      }
      const sx = Math.cos(star.angle) * star.radius;
      const sy = Math.sin(star.angle) * star.radius;
      const alpha = Math.min(1, star.radius / (MAX_R * 0.4));
      const size  = 1.5 + (star.radius / MAX_R) * 2;
      starLayer.circle(sx, sy, size).fill({ color: 0xccaaff, alpha });
    }
  };

  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    portalTex.destroy(true);
    [label, bg, mesh, outerGlow, starLayer].forEach(e => e.destroy({ children: true }));
  };
}
