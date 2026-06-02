/**
 * MESH CUTSCENE: Flood Burst  [sequence]
 *
 * A sealed floodgate at the tunnel end fails under pressure. The sequence:
 *
 *   1. Dark tunnel, ominous creaking (camera trembles).
 *   2. Water seeps through gate cracks (particle drips).
 *   3. Gate EXPLODES. White flash. A wall of water (MeshRope) rushes in.
 *   4. Water fills the lower half (second MeshPlane rises from the floor).
 *   5. Debris on the surface, turbulence, warning text.
 *
 * Two mesh techniques in one scene:
 *   - MeshRope: the curved wave-front that rushes across (an animated
 *     "standing wave" shape that translates left→right at high speed).
 *   - MeshPlane: the flood body that rises from the floor with a
 *     turbulent top-row surface, while the bottom stays flat.
 * VFX type: defineSequence — complete choreographed moment with clear start/end.
 */
import { animate } from 'animejs';
import { createTimeline } from 'animejs';
import { Container, Graphics, Mesh, MeshRope, PlaneGeometry, Point, Text, Texture } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeDropletTexture, makeSoftPuffTexture } from '../particleTextures';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

const WAVE_SEGS = 22;
const FLOOD_COLS = 44;
const FLOOD_ROWS = 8;

function makeWaterTex(): Texture {
  const g = new Graphics();
  const H = 32;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const c = v < 0.1
      ? lerpHex(0xaaddff, 0x5599cc, v / 0.1)
      : lerpHex(0x2266aa, 0x041020, (v - 0.1) / 0.9);
    g.rect(0, y, 2, 1).fill(c);
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function makeWaveTex(): Texture {
  const H = 48;
  const g = new Graphics();
  for (let y = 0; y < H; y++) {
    const v = Math.abs(y / H * 2 - 1);
    const a = Math.pow(Math.max(0, 1 - v), 1.5);
    const col = lerpHex(0xffffff, 0x55aadd, v);
    g.rect(0, y, 4, 1).fill({ color: col, alpha: a });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function lerpHex(a: number, b: number, t: number): number {
  const ar=(a>>16)&0xff, ag=(a>>8)&0xff, ab=a&0xff;
  const br=(b>>16)&0xff, bg=(b>>8)&0xff, bb=b&0xff;
  return (Math.round(ar+(br-ar)*t)<<16)|(Math.round(ag+(bg-ag)*t)<<8)|Math.round(ab+(bb-ab)*t);
}

const floodBurstSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'floodBurst',
  async build({ w, h }, { layer }) {
    const FLOOD_Y_MAX = h * 0.55;  // flood surface at max fill
    const FLOOR_Y     = h - 2;

    // Background — dark tunnel
    const bg = new Graphics().rect(0, 0, w, h).fill(0x050608);
    bg.alpha = 0;
    layer.addChild(bg);

    // Tunnel walls
    const tunnelG = new Graphics();
    tunnelG.rect(0, 0, w * 0.15, h).fill(0x0e0c08);
    tunnelG.rect(w * 0.85, 0, w * 0.15, h).fill(0x0e0c08);
    for (let y = 8; y < h; y += 22)
      tunnelG.rect(0, y, w, 1).fill({ color: 0x161412, alpha: 0.5 });
    tunnelG.alpha = 0;
    layer.addChild(tunnelG);

    // Floodgate (right side)
    const gateG = new Graphics();
    const GX = w * 0.82;
    gateG.roundRect(GX, 0, w * 0.18, h, 2).fill(0x3a2a18).stroke({ color: 0x1a1008, width: 2 });
    for (let y = 12; y < h - 12; y += 24)
      gateG.rect(GX + 4, y, w * 0.18 - 8, 4).fill(0x2a1e10);
    gateG.alpha = 0;
    layer.addChild(gateG);

    // Gate stress cracks
    const gCrackG = new Graphics();
    gCrackG.alpha = 0;
    layer.addChild(gCrackG);

    // Pressure water drips at cracks
    const dropTex = makeDropletTexture();
    const drips = new ParticleEmitter({
      texture: dropTex, maxParticles: 20, emitting: false,
      lifespan: { min: 400, max: 900 }, speed: { min: 40, max: 80 },
      angle: { min: 85, max: 95 }, accelerationY: 280,
      x: { min: -12, max: 12 },
      scale: { start: { min: 0.4, max: 0.8 }, end: 0.05 },
      alpha: { start: 0.9, end: 0 },
      tint: { start: 0xaaddff, end: 0x224466 },
    });
    drips.x = GX + 4; drips.y = h * 0.4;
    layer.addChild(drips.container);

    // Flash overlay
    const flashG = new Graphics().rect(0, 0, w, h).fill(0xffffff);
    flashG.alpha = 0;
    layer.addChild(flashG);

    // ── MESH: Wave front (MeshRope) ───────────────────────────────────────
    const waveTex = makeWaveTex();
    const wavePts = Array.from({ length: WAVE_SEGS }, () => new Point(w + 60, h / 2));
    const waveRope = new MeshRope({ texture: waveTex, points: wavePts });
    waveRope.alpha = 0;
    layer.addChild(waveRope);

    // ── MESH: Flood body (MeshPlane) ──────────────────────────────────────
    const waterTex = makeWaterTex();
    const floodGeo = new PlaneGeometry({ width: w, height: h * 0.55, verticesX: FLOOD_COLS, verticesY: FLOOD_ROWS });
    const floodMesh = new Mesh({ geometry: floodGeo, texture: waterTex });
    floodMesh.y = FLOOR_Y;  // start below screen
    floodMesh.alpha = 0;
    layer.addChild(floodMesh);

    const { buffer: fbuf } = floodGeo.getAttribute('aPosition');
    const frestX = new Float32Array(FLOOD_COLS * FLOOD_ROWS);
    const frestY = new Float32Array(FLOOD_COLS * FLOOD_ROWS);
    for (let i = 0; i < FLOOD_COLS * FLOOD_ROWS; i++) {
      frestX[i] = fbuf.data[i * 2];
      frestY[i] = fbuf.data[i * 2 + 1];
    }

    // Foam / spray
    const puffTex = makeSoftPuffTexture();
    const spray = new ParticleEmitter({
      texture: puffTex, maxParticles: 35, emitting: false,
      lifespan: { min: 600, max: 1400 }, speed: { min: 40, max: 120 },
      angle: { min: 180, max: 360 }, x: { min: -w/2, max: w/2 },
      scale: { start: { min: 0.3, max: 0.8 }, end: 1.6 },
      alpha: { start: 0.55, end: 0 },
      tint: { start: 0xaaddff, end: 0x041020 },
    });
    spray.x = GX; spray.y = h * 0.5;
    layer.addChild(spray.container);

    const dangerText = new Text({
      text: '⚠  FLOOD ALERT — ESCAPE ROUTE COMPROMISED  ⚠',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0xff4400, fontWeight: 'bold', letterSpacing: 1 },
    });
    dangerText.anchor.set(0.5); dangerText.x = w / 2; dangerText.y = h * 0.12;
    dangerText.alpha = 0;
    layer.addChild(dangerText);

    let t = 0;
    let waveX = w + 60;     // wave front X position
    let waveRushing = false;
    let floodRising = false;
    let floodRiseY = FLOOR_Y;

    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      const s = dt.deltaMS / 1000;

      // Wave rush
      if (waveRushing) {
        waveX -= 620 * s;
        for (let i = 0; i < WAVE_SEGS; i++) {
          const frac = i / (WAVE_SEGS - 1);
          // Wave profile: steep front, trailing body
          const yOff = Math.sin(frac * Math.PI) * 45 + Math.sin(frac * Math.PI * 3 - t * 8) * 12;
          wavePts[i].x = waveX + frac * 90;
          wavePts[i].y = FLOOD_Y_MAX + 20 - yOff;
        }
        if (waveX < -100) { waveRushing = false; waveRope.alpha = 0; }
      }

      // Flood body rise
      if (floodRising && floodRiseY > FLOOD_Y_MAX) {
        floodRiseY -= 180 * s;
        floodMesh.y = Math.max(FLOOD_Y_MAX, floodRiseY);
      }

      // Animate flood surface (top row)
      for (let col = 0; col < FLOOD_COLS; col++) {
        const rx = frestX[col];
        const turb = Math.sin(rx * 0.04 - t * 3.5) * 7 + Math.sin(rx * 0.08 - t * 6) * 3;
        fbuf.data[col * 2]     = rx;
        fbuf.data[col * 2 + 1] = 0 + turb;
      }
      fbuf.update();
    };

    // Pre-collapse: pressure builds
    animate(bg, { alpha: 1, duration: 700, easing: 'easeIn' });
    await new Promise<void>((res) => setTimeout(res, 400));
    animate(tunnelG, { alpha: 1, duration: 1000 });
    animate(gateG, { alpha: 1, duration: 900 });

    // Cracks appear, drips start
    await new Promise<void>((res) => setTimeout(res, 1800));
    drips.emitting = true;
    // Draw stress cracks
    gCrackG.moveTo(GX + 6, h*0.3).lineTo(GX + 14, h*0.55).lineTo(GX + 8, h*0.75)
      .stroke({ color: 0x000000, width: 2, alpha: 0.8 });
    gCrackG.moveTo(GX + 18, h*0.2).lineTo(GX + 12, h*0.45)
      .stroke({ color: 0x000000, width: 1.5, alpha: 0.6 });
    animate(gCrackG, { alpha: [0, 0.9], duration: 800 });
    // Gate trembles
    animate(gateG, { x: [0, -2, 2, -1, 1, 0], duration: 600 });

    // BURST
    await new Promise<void>((res) => setTimeout(res, 1300));
    drips.emitting = false;
    animate(flashG, { alpha: [0, 1, 0], duration: 400, easing: 'easeOut' });
    await new Promise<void>((res) => setTimeout(res, 220));
    animate(gateG, { alpha: 0, duration: 150 });
    animate(gCrackG, { alpha: 0, duration: 150 });
    waveRope.alpha = 1;
    waveRushing = true;
    floodMesh.alpha = 1;
    floodRising = true;
    spray.emitting = true;
    spray.x = GX;
    app.ticker.add(tick);

    await new Promise<void>((res) => setTimeout(res, 1500));
    spray.emitting = false;
    animate(dangerText, { alpha: [0, 1, 0.3, 1, 0.3, 1], duration: 2000,
      keyframes: [{ alpha: 0 }, { alpha: 1, duration: 250 }, { alpha: 0.2, duration: 200 }, { alpha: 1, duration: 250 }, { alpha: 0.2, duration: 200 }, { alpha: 1, duration: 1100 }]
    });

    // Hold the scene
    await new Promise<void>((res) => setTimeout(res, 2500));

    // Cleanup
    app.ticker.remove(tick);
    drips.destroy(); spray.destroy();
    dropTex.destroy(true); puffTex.destroy(true); waveTex.destroy(true); waterTex.destroy(true);
    [bg, tunnelG, gateG, gCrackG, flashG, waveRope, floodMesh, dangerText].forEach(e => e.destroy({ children: true }));
  },
});

export function floodBurst(root: Container, w: number, h: number): () => void {
  let cancelled = false;

  const ctx: SequenceContext = {
    camera: null as any,
    layer: root,
    stage: root,
    size: { width: w, height: h },
    cutscene: () => Promise.resolve(),
    timeline: () => createTimeline(),
  };

  const loop = async () => {
    while (!cancelled) {
      await floodBurstSequence.build({ w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 400));
    }
  };
  loop();

  return () => {
    cancelled = true;
  };
}
