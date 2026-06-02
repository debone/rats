/**
 * MESH: Gerstner Ocean Waves
 *
 * Gerstner waves are the physically correct deep-water wave model.
 * Unlike simple sine waves (only vertical displacement), Gerstner waves
 * also shift vertices HORIZONTALLY — bunching them under crests and
 * spreading them in troughs. This makes crest tips sharp and troughs flat,
 * exactly matching the real ocean silhouette.
 *
 *   Δx = -Q · A · sin(k · rx - ω · t + φ)
 *   Δy = -A · cos(k · rx - ω · t + φ)    (negative = up in screen space)
 *
 * Four overlapping wave components sum to give organic motion.
 * Displacement falls off exponentially with depth so the seabed stays still.
 *
 * A Sprite cannot deform its texture. Only a mesh lets you move each vertex
 * independently while the texture stretches across the geometry.
 */
import { Container, Graphics, Mesh, PlaneGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const COLS = 80;
const ROWS = 20;

// Gerstner wave components: { amplitude px, wavelength px, speed rad/s, phase rad, steepness }
const WAVES = [
  { A: 22, wl: 210, spd: 1.9, phi: 0.00, Q: 0.42 },
  { A: 11, wl: 130, spd: 2.8, phi: 1.73, Q: 0.38 },
  { A:  6, wl:  75, spd: 4.1, phi: 0.54, Q: 0.28 },
  { A:  3, wl:  42, spd: 6.3, phi: 2.10, Q: 0.20 },
];

function makeOceanTex(tw: number, th: number): Texture {
  const g = new Graphics();
  for (let y = 0; y < th; y++) {
    const v = y / th;
    let c: number;
    if (v < 0.05) {
      // foam/crest highlight
      c = lerp3(0xd8f4ff, 0x5ab8d0, v / 0.05);
    } else if (v < 0.35) {
      c = lerp3(0x5ab8d0, 0x0d5f82, (v - 0.05) / 0.30);
    } else {
      c = lerp3(0x0d5f82, 0x020d1a, (v - 0.35) / 0.65);
    }
    g.rect(0, y, tw, 1).fill(c);
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function lerp3(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) |
         (Math.round(ag + (bg - ag) * t) << 8)  |
          Math.round(ab + (bb - ab) * t);
}

export function gerstnerOcean(root: Container, w: number, h: number): () => void {
  const OCEAN_TOP = h * 0.38;
  const OCEAN_H   = h - OCEAN_TOP;

  const label = new Text({
    text: 'MESH: Gerstner ocean — horizontal+vertical displacement creates sharp crests. Four wave components summed.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x66ddff, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // Sky
  const sky = new Graphics();
  for (let y = 0; y < OCEAN_TOP; y++) {
    const v = y / OCEAN_TOP;
    sky.rect(0, 16, w, OCEAN_TOP - 16).fill(lerp3(0x0d1b2e, 0x1a2d45, v));
  }
  sky.rect(0, 16, w, OCEAN_TOP - 16).fill(lerp3(0x0d1b2e, 0x132438, 1));
  root.addChild(sky);

  // Distant horizon glow
  const horizon = new Graphics();
  for (let i = 6; i >= 0; i--) {
    horizon.rect(0, OCEAN_TOP - i * 3, w, 3).fill({ color: 0x3a8faa, alpha: (7 - i) / 7 * 0.18 });
  }
  root.addChild(horizon);

  // Moon
  const moon = new Graphics();
  moon.circle(0, 0, 18).fill(0xeef8ff);
  moon.circle(5, -4, 12).fill(lerp3(0x0d1b2e, 0x132438, 0.5));
  moon.x = w * 0.8; moon.y = h * 0.12;
  root.addChild(moon);
  // Moon reflection shimmer (vertical line on water)
  const moonRef = new Graphics();
  moonRef.rect(w * 0.8 - 4, OCEAN_TOP, 8, OCEAN_H).fill({ color: 0xeef8ff, alpha: 0.08 });
  root.addChild(moonRef);

  const oceanTex = makeOceanTex(2, 64);
  const geo = new PlaneGeometry({ width: w, height: OCEAN_H, verticesX: COLS, verticesY: ROWS });
  const ocean = new Mesh({ geometry: geo, texture: oceanTex });
  ocean.y = OCEAN_TOP;
  root.addChild(ocean);

  const { buffer } = geo.getAttribute('aPosition');
  // Cache rest X so we can restore it
  const restX = new Float32Array(COLS * ROWS);
  const restY = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    restX[i] = buffer.data[i * 2];
    restY[i] = buffer.data[i * 2 + 1];
  }

  // Spray particles
  const spray = new Graphics();
  spray.y = OCEAN_TOP;
  root.addChild(spray);

  interface SprayDot { x: number; y: number; vx: number; vy: number; age: number; life: number; }
  const dots: SprayDot[] = [];

  // Precompute wave constants
  const waveK   = WAVES.map(w => (2 * Math.PI) / w.wl);
  const waveOmg = WAVES.map((_w, i) => Math.sqrt(9.8 * waveK[i]) * 0.38);

  let t = 0;

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;
    t += s;

    // Update ocean vertices
    for (let row = 0; row < ROWS; row++) {
      const depth = row / (ROWS - 1);
      const falloff = Math.exp(-depth * 3.5);
      for (let col = 0; col < COLS; col++) {
        const i  = row * COLS + col;
        const rx = restX[i];
        let dx = 0, dy = 0;
        for (let wi = 0; wi < WAVES.length; wi++) {
          const { A, Q } = WAVES[wi];
          const k = waveK[wi], omg = waveOmg[wi], phi = WAVES[wi].phi;
          const phase = k * rx - omg * t + phi;
          dx += -Q * A * Math.sin(phase);
          dy += -A * Math.cos(phase);
        }
        buffer.data[i * 2]     = rx + dx * falloff;
        buffer.data[i * 2 + 1] = restY[i] + dy * falloff;
      }
    }
    buffer.update();

    // Spray at crest positions
    if (Math.random() < 0.35) {
      const rx = Math.random() * w;
      let surfY = 0;
      for (let wi = 0; wi < WAVES.length; wi++) {
        const { A } = WAVES[wi];
        const phase = waveK[wi] * rx - waveOmg[wi] * t + WAVES[wi].phi;
        surfY += -A * Math.cos(phase);
      }
      if (surfY < -22) {
        for (let n = 0; n < 2; n++) {
          dots.push({ x: rx, y: surfY, vx: (Math.random() - 0.5) * 40, vy: -25 - Math.random() * 35, age: 0, life: 0.5 + Math.random() * 0.5 });
        }
      }
    }

    spray.clear();
    for (let di = dots.length - 1; di >= 0; di--) {
      const d = dots[di];
      d.age += s;
      if (d.age > d.life) { dots.splice(di, 1); continue; }
      d.vy += 60 * s;
      d.x += d.vx * s; d.y += d.vy * s;
      const alpha = (1 - d.age / d.life) * 0.7;
      spray.circle(d.x, d.y, 1.5).fill({ color: 0xd8f4ff, alpha });
    }

    // Subtle moon shimmer
    moonRef.alpha = 0.06 + 0.04 * Math.sin(t * 2.3);
  };

  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    oceanTex.destroy(true);
    [label, sky, horizon, moon, moonRef, ocean, spray].forEach(e => e.destroy({ children: true }));
  };
}
