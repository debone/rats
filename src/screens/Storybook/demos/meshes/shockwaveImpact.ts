/**
 * MESH: Shockwave Impact
 *
 * Click anywhere to detonate a shockwave. An expanding ring of vertex
 * displacement rolls outward across a subdivided MeshPlane at 260px/s.
 * Within the ring band, vertices are pushed upward by a Gaussian envelope.
 *
 * The combined effect of:
 *   - Ring displacement on the ground mesh
 *   - A bright bloom flash at the impact point
 *   - Debris chunks flying outward with gravity
 *
 * ...gives the full "game impact hit" VFX template in one demo.
 *
 * The displacement formula:
 *   band_t = (r - ring_radius) / RING_WIDTH   (−1 → +1 inside the band)
 *   disp_y = −A · exp(−band_t²·2) · exp(−age·4)
 *
 * This MeshPlane technique is used in games for:
 * explosion craters, water splashes, force field hits, landing impacts.
 */
import { Container, Graphics, Mesh, PlaneGeometry, Texture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { demoMouse } from '../demoMouse';
import { app } from '@/main';

const COLS      = 50;
const ROWS      = 30;
const RING_SPD  = 260;
const RING_W    = 55;
const DISP_AMP  = 28;
const MAX_WAVES = 4;

function makeGroundTex(tw: number, th: number): Texture {
  const g = new Graphics();
  g.rect(0, 0, tw, th).fill(0x1a1208);
  const TILE = 28;
  for (let row = 0; row * TILE < th; row++) {
    for (let col = 0; col * TILE < tw; col++) {
      // Stone tile
      const dark = (row + col) % 2 === 0;
      g.rect(col * TILE + 1, row * TILE + 1, TILE - 2, TILE - 2).fill(dark ? 0x2a1e10 : 0x241810);
      // Crack lines
      if (Math.random() < 0.3) {
        const x1 = col * TILE + Math.random() * TILE;
        const y1 = row * TILE + Math.random() * TILE;
        g.moveTo(x1, y1).lineTo(x1 + (Math.random() - 0.5) * 12, y1 + (Math.random() - 0.5) * 12)
          .stroke({ color: 0x0a0806, width: 1, alpha: 0.6 });
      }
    }
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

interface Wave { cx: number; cy: number; age: number; }
interface Debris { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; }

export function shockwaveImpact(root: Container, w: number, h: number): () => void {
  const GROUND_TOP = h * 0.45;
  const GROUND_H   = h - GROUND_TOP;

  const label = new Text({
    text: 'MESH: Shockwave impact — click to detonate. Expanding ring displacement + flash + debris. Game impact VFX template.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0xff9944, letterSpacing: 1 },
  });
  label.x = 6; label.y = 6;
  root.addChild(label);

  // Sky / air region
  const sky = new Graphics();
  for (let y = 16; y < GROUND_TOP; y++) {
    const t = (y - 16) / (GROUND_TOP - 16);
    sky.rect(0, y, w, 1).fill(lerpHex(0x110c08, 0x1a1208, t));
  }
  root.addChild(sky);

  const groundTex = makeGroundTex(512, 256);
  const geo   = new PlaneGeometry({ width: w, height: GROUND_H, verticesX: COLS, verticesY: ROWS });
  const plane = new Mesh({ geometry: geo, texture: groundTex });
  plane.y = GROUND_TOP;
  root.addChild(plane);

  const { buffer } = geo.getAttribute('aPosition');
  const restX = new Float32Array(COLS * ROWS);
  const restY = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    restX[i] = buffer.data[i * 2];
    restY[i] = buffer.data[i * 2 + 1];
  }

  const flashLayer  = new Container();
  const debrisLayer = new Container();
  root.addChild(flashLayer, debrisLayer);

  const waves: Wave[] = [];
  const debris: Debris[] = [];
  const flashes: { g: Graphics; age: number } [] = [];

  const onClick = (e: MouseEvent) => {
    const { x: mx, y: my } = demoMouse(e);
    if (waves.length >= MAX_WAVES) waves.shift();
    waves.push({ cx: mx, cy: my - GROUND_TOP, age: 0 });

    // Flash
    const flash = new Graphics().circle(0, 0, 8).fill({ color: 0xffee88, alpha: 1 });
    flash.x = mx; flash.y = my;
    flashLayer.addChild(flash);
    flashes.push({ g: flash, age: 0 });

    // Debris
    const count = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 80 + Math.random() * 160;
      debris.push({
        x: mx, y: my,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        age: 0, life: 0.6 + Math.random() * 0.6,
        size: 2 + Math.random() * 4,
      });
    }
  };
  window.addEventListener('click', onClick);

  const debrisG = new Graphics();
  debrisLayer.addChild(debrisG);

  const tick = (dt: { deltaMS: number }) => {
    const s = dt.deltaMS / 1000;

    // Advance waves
    for (const w of waves) w.age += s;

    // Displace ground vertices
    for (let i = 0; i < COLS * ROWS; i++) {
      const vx = restX[i], vy = restY[i];
      let dy = 0;
      for (const wv of waves) {
        // Transform from screen space: cx,cy are relative to GROUND_TOP
        const r = Math.hypot(vx - wv.cx, vy - wv.cy);
        const ringR = wv.age * RING_SPD;
        const bandT = (r - ringR) / RING_W;
        if (Math.abs(bandT) < 1) {
          const env = Math.exp(-bandT * bandT * 2.5) * Math.exp(-wv.age * 3.5);
          dy -= DISP_AMP * env;
        }
      }
      buffer.data[i * 2]     = vx;
      buffer.data[i * 2 + 1] = vy + dy;
    }
    buffer.update();

    // Flashes
    for (let fi = flashes.length - 1; fi >= 0; fi--) {
      const f = flashes[fi];
      f.age += s;
      if (f.age > 0.5) { f.g.destroy(); flashes.splice(fi, 1); continue; }
      const t = f.age / 0.5;
      f.g.scale.set(1 + t * 5);
      f.g.alpha = 1 - t;
    }

    // Debris
    debrisG.clear();
    for (let di = debris.length - 1; di >= 0; di--) {
      const d = debris[di];
      d.age += s;
      if (d.age > d.life) { debris.splice(di, 1); continue; }
      d.vy += 300 * s;
      d.x += d.vx * s; d.y += d.vy * s;
      const alpha = 1 - d.age / d.life;
      debrisG.rect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size)
        .fill({ color: 0x886633, alpha });
    }
  };

  app.ticker.add(tick);

  return () => {
    window.removeEventListener('click', onClick);
    app.ticker.remove(tick);
    groundTex.destroy(true);
    [label, sky, plane, flashLayer, debrisLayer].forEach(e => e.destroy({ children: true }));
  };
}

function lerpHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) |
         (Math.round(ag + (bg - ag) * t) << 8)  |
          Math.round(ab + (bb - ab) * t);
}
