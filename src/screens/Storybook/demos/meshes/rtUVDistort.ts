/**
 * MESH: RenderTexture UV Distortion (Heat / Underwater)
 *
 * Technique: capture an animated scene into a RenderTexture every frame,
 * then display it through a MeshPlane whose UV coordinates are perturbed —
 * NOT the vertex positions (that's screenBulge). The result is a post-process
 * warp that remaps which pixel from the source appears where on screen.
 *
 * UV distortion formula (heat shimmer mode):
 *   u' = u + sin(v * 14 + t * 4) * strength * (1 − v)
 *   (Only U is shifted, stronger near the top of the heat source)
 *
 * UV distortion formula (underwater mode):
 *   u' = u + sin(v * 8  + t * 2.1) * strength
 *   v' = v + sin(u * 10 + t * 1.7) * strength * 0.7
 *
 * The difference from vertex displacement: vertices stay fixed (the mesh
 * covers the screen uniformly), but the texture lookup shifts — effectively
 * a post-process filter implemented entirely in geometry/UV manipulation.
 */
import { Container, Graphics, Mesh, PlaneGeometry, RenderTexture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const VX = 40;
const VY = 30;

export function rtUVDistort(root: Container, w: number, h: number): () => void {
  const PH = h - 16;

  const label = new Text({
    text: 'MESH: RT UV distortion — UV coords warped per-vertex (not position). Click to toggle heat/underwater.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x44ffcc, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // ── Scene to capture ────────────────────────────────────────────────────
  const scene = new Container();

  const sceneBg = new Graphics().rect(0, 0, w, PH).fill(0x081420);
  scene.addChild(sceneBg);

  // Animated "fish" — simple ellipses on sine paths
  interface Fish { g: Graphics; x0: number; y0: number; spd: number; phase: number; amp: number; col: number; }
  const fishes: Fish[] = [];
  for (let i = 0; i < 7; i++) {
    const g = new Graphics();
    const col = [0xff6644, 0xffcc44, 0x44ddff, 0xff44aa, 0xaaff44, 0xff8844, 0x44aaff][i];
    g.ellipse(0, 0, 18 + i * 3, 8 + i).fill(col);
    g.ellipse(12 + i, 0, 6, 4).fill(lighten(col, 0.35));
    scene.addChild(g);
    fishes.push({ g, x0: 40 + Math.random() * (w - 80), y0: 40 + Math.random() * (PH - 80), spd: 0.4 + Math.random() * 0.6, phase: Math.random() * Math.PI * 2, amp: 20 + Math.random() * 30, col });
  }

  // Bubbles
  interface Bubble { x: number; y: number; r: number; spd: number; }
  const bubbles: Bubble[] = Array.from({ length: 14 }, () => ({
    x: 20 + Math.random() * (w - 40), y: PH + 10, r: 3 + Math.random() * 7, spd: 15 + Math.random() * 25,
  }));

  // ── RenderTexture + warp mesh ─────────────────────────────────────────
  const rt  = RenderTexture.create({ width: w, height: PH });
  const geo = new PlaneGeometry({ width: w, height: PH, verticesX: VX, verticesY: VY });
  const plane = new Mesh({ geometry: geo, texture: rt });
  plane.y = 16;
  root.addChild(plane);

  const { buffer: uvBuf } = geo.getAttribute('aUV');

  // Cache rest UVs
  const restU = new Float32Array(VX * VY);
  const restV = new Float32Array(VX * VY);
  for (let i = 0; i < VX * VY; i++) {
    restU[i] = uvBuf.data[i * 2];
    restV[i] = uvBuf.data[i * 2 + 1];
  }

  let mode: 'heat' | 'water' = 'water';
  const modeLabel = new Text({
    text: 'MODE: underwater',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xffffff },
  });
  modeLabel.x = 6; modeLabel.y = h - 14;
  root.addChild(modeLabel);

  const toggle = () => {
    mode = mode === 'heat' ? 'water' : 'heat';
    modeLabel.text = `MODE: ${mode === 'heat' ? 'heat shimmer' : 'underwater'}`;
  };
  window.addEventListener('click', toggle);

  let t = 0;
  const bubbleG = new Graphics();
  scene.addChild(bubbleG);

  const tick = (dt: { deltaMS: number }) => {
    t += dt.deltaMS / 1000;

    // Animate scene
    for (const f of fishes) {
      f.g.x = f.x0 + Math.cos(t * f.spd + f.phase) * f.amp;
      f.g.y = f.y0 + Math.sin(t * f.spd * 0.7 + f.phase) * f.amp * 0.4;
      f.g.rotation = Math.sin(t * f.spd + f.phase) * 0.2;
    }

    bubbleG.clear();
    for (const b of bubbles) {
      b.y -= b.spd * (t % 1 < 0.016 ? 0.016 : dt.deltaMS / 1000);
      if (b.y < -b.r) b.y = PH + b.r;
      bubbleG.circle(b.x, b.y, b.r).fill({ color: 0xaaddff, alpha: 0.22 });
      bubbleG.circle(b.x, b.y, b.r).stroke({ color: 0xeeffff, width: 1, alpha: 0.35 });
    }

    // Capture scene
    app.renderer.render({ container: scene, target: rt });

    // Warp UVs
    const str = mode === 'heat' ? 0.018 : 0.012;
    for (let i = 0; i < VX * VY; i++) {
      const ru = restU[i], rv = restV[i];
      if (mode === 'heat') {
        uvBuf.data[i * 2]     = ru + Math.sin(rv * 14 + t * 4.5) * str * (1 - rv * 0.6);
        uvBuf.data[i * 2 + 1] = rv;
      } else {
        uvBuf.data[i * 2]     = ru + Math.sin(rv * 8  + t * 2.1) * str;
        uvBuf.data[i * 2 + 1] = rv + Math.sin(ru * 10 + t * 1.7) * str * 0.7;
      }
    }
    uvBuf.update();
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('click', toggle);
    app.ticker.remove(tick);
    rt.destroy(true);
    scene.destroy({ children: true });
    [label, plane, modeLabel].forEach(e => e.destroy({ children: true }));
  };
}

function lighten(color: number, amt: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(amt * 255));
  const g = Math.min(255, ((color >>  8) & 0xff) + Math.round(amt * 255));
  const b = Math.min(255, (color & 0xff)         + Math.round(amt * 255));
  return (r << 16) | (g << 8) | b;
}
