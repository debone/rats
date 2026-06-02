/**
 * MESH CUTSCENE: Sewer Channel  [sequence]
 *
 * Ambient establishing shot of a sewer tunnel. The sewage river is a
 * MeshPlane whose top-row vertices undulate — three overlapping sine
 * components give the characteristic uneven, sluggish sewer-flow surface.
 *
 * Everything below the surface is the water body (texture gradient from
 * murky foam-green at V=0 to absolute black at V=1). The mesh lets the
 * surface ripple while the floor stays perfectly flat — impossible with
 * a plain sprite.
 *
 * Rats scurry along the ledge. Drips fall from ceiling pipes. A toxic
 * green glow rises from the sewage surface.
 *
 * VFX type: defineSequence — establishing shot with scheduled animation beats.
 */
import { animate } from 'animejs';
import { Container, Graphics, Mesh, PlaneGeometry, Text, Texture } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeDropletTexture, makeSoftPuffTexture } from '../particleTextures';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

const sewerChannelSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'sewerChannel',
  async build(_params, _ctx) { /* storybook drives via loop below */ },
});

const COLS = 56;
const ROWS = 10;

function makeSewerTex(): Texture {
  const g = new Graphics();
  const H = 64;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const c = v < 0.07
      ? lerpHex(0x99dd44, 0x558822, v / 0.07)
      : lerpHex(0x3a6812, 0x040901, (v - 0.07) / 0.93);
    g.rect(0, y, 2, 1).fill(c);
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

function makeRatG(flipped: boolean): Graphics {
  const r = new Graphics();
  r.ellipse(0, 0, 10, 5).fill(0x2a1c0c);
  r.ellipse(flipped ? -7 : 7, -1, 5, 3.5).fill(0x221608);
  r.circle(flipped ? -10.5 : 10.5, -2.5, 1.5).fill({ color: 0xff3300, alpha: 0.9 });
  const tx = flipped ? 7 : -7;
  r.moveTo(tx, 2).bezierCurveTo(tx+(flipped?10:-10), 8, tx+(flipped?20:-20), 3, tx+(flipped?25:-25), 6)
   .stroke({ color: 0x1a1006, width: 1.5 });
  return r;
}

export function sewerChannel(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) =>
    timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms));

  const WATER_Y = h * 0.55;
  const WATER_H = h - WATER_Y;

  // Background
  const bg = new Graphics().rect(0, 0, w, h).fill(0x040603);
  bg.alpha = 0;
  root.addChild(bg);

  // Stone wall tiles (upper region)
  const wallG = new Graphics();
  const BW = w / 9, BH = WATER_Y / 7;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 9; col++) {
      const off = (row % 2) * (BW / 2);
      wallG.rect(col * BW + off - (off > 0 ? 0 : 0), row * BH, BW - 1.5, BH - 1.5)
        .fill([0x161410, 0x131210, 0x111008][col % 3]);
    }
  }
  wallG.alpha = 0;
  root.addChild(wallG);

  // Infrastructure: ceiling pipe + side drain pipes
  const pipes = new Graphics();
  pipes.roundRect(0, 14, w, 11, 3).fill(0x2a2010).stroke({ color: 0x0a0806, width: 1 });
  pipes.roundRect(0, h * 0.28, 14, 44, 2).fill(0x352818).stroke({ color: 0x0a0804, width: 1 });
  pipes.circle(14, h * 0.28 + 22, 7).fill(0x1a1008);
  pipes.roundRect(w - 14, h * 0.22, 14, 54, 2).fill(0x352818).stroke({ color: 0x0a0804, width: 1 });
  pipes.circle(w - 14, h * 0.22 + 27, 7).fill(0x1a1008);
  pipes.alpha = 0;
  root.addChild(pipes);

  // Ledge
  const ledge = new Graphics()
    .rect(0, WATER_Y - 7, w, 7).fill(0x221a0c)
    .rect(0, WATER_Y - 7, w, 7).stroke({ color: 0x0a0804, width: 1 });
  ledge.alpha = 0;
  root.addChild(ledge);

  // ── MESH: Sewage river ────────────────────────────────────────────────
  const sewTex = makeSewerTex();
  const geo = new PlaneGeometry({ width: w, height: WATER_H, verticesX: COLS, verticesY: ROWS });
  const waterMesh = new Mesh({ geometry: geo, texture: sewTex });
  waterMesh.y = WATER_Y;
  waterMesh.alpha = 0;
  root.addChild(waterMesh);

  const { buffer } = geo.getAttribute('aPosition');
  const restX = new Float32Array(COLS * ROWS);
  const restY = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    restX[i] = buffer.data[i * 2];
    restY[i] = buffer.data[i * 2 + 1];
  }

  // Surface glow
  const glow = new Graphics();
  for (let i = 5; i >= 0; i--)
    glow.rect(0, WATER_Y - i * 5, w, 5).fill({ color: 0x55aa22, alpha: i * 0.025 });
  glow.alpha = 0;
  root.addChild(glow);

  // Rats on ledge
  const rat1 = makeRatG(false); rat1.x = -24; rat1.y = WATER_Y - 9; rat1.alpha = 0;
  const rat2 = makeRatG(true);  rat2.x = w + 24; rat2.y = WATER_Y - 9; rat2.alpha = 0;
  root.addChild(rat1, rat2);

  // Particles
  const dropTex = makeDropletTexture();
  const puffTex = makeSoftPuffTexture();
  const drips = new ParticleEmitter({
    texture: dropTex, maxParticles: 25, emitting: false,
    lifespan: { min: 500, max: 1100 }, speed: { min: 50, max: 110 },
    angle: { min: 87, max: 93 }, accelerationY: 220,
    x: { min: -w / 2, max: w / 2 },
    scale: { start: { min: 0.3, max: 0.6 }, end: 0.05 },
    alpha: { start: 0.8, end: 0 },
    tint: { start: 0x99dd44, end: 0x223308 },
  });
  drips.x = w / 2; drips.y = 26;
  root.addChild(drips.container);

  const mist = new ParticleEmitter({
    texture: puffTex, maxParticles: 18, emitting: false,
    lifespan: { min: 2200, max: 4500 }, speed: { min: 3, max: 10 },
    angle: { min: 258, max: 282 }, x: { min: -w / 2, max: w / 2 },
    scale: { start: { min: 0.3, max: 0.9 }, end: 2.2 },
    alpha: { start: 0.2, end: 0 },
    tint: { start: 0x33660e, end: 0x040603 },
  });
  mist.x = w / 2; mist.y = WATER_Y - 2;
  root.addChild(mist.container);

  // Label
  const label = new Text({
    text: 'SEWER CHANNEL B  ·  SECTOR 7  ·  RESTRICTED ACCESS',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x558822, letterSpacing: 2 },
  });
  label.anchor.set(0.5, 0);
  label.x = w / 2; label.y = 8; label.alpha = 0;
  root.addChild(label);

  let t = 0;
  const tick = (dt: { deltaMS: number }) => {
    t += dt.deltaMS / 1000;
    for (let col = 0; col < COLS; col++) {
      const rx = restX[col];
      const dy = Math.sin(rx * 0.03 - t * 2.6) * 8
               + Math.sin(rx * 0.055 - t * 4.0) * 4
               + Math.sin(rx * 0.014 - t * 1.2) * 13;
      buffer.data[col * 2]     = rx;
      buffer.data[col * 2 + 1] = dy;
    }
    buffer.update();
    glow.alpha = 0.6 + 0.4 * Math.sin(t * 2.1);
  };

  // Sequence
  animate(bg, { alpha: 1, duration: 900, easing: 'easeIn' });
  later(() => {
    animate(wallG, { alpha: 1, duration: 1400, easing: 'easeOut' });
    animate(pipes,  { alpha: 1, duration: 1100 });
  }, 300);
  later(() => {
    animate(ledge, { alpha: 1, duration: 700 });
    animate(waterMesh, { alpha: 1, duration: 1100, easing: 'easeIn' });
    animate(glow, { alpha: [0, 0.9], duration: 1400 });
    drips.emitting = true; mist.emitting = true;
    app.ticker.add(tick);
  }, 1400);
  later(() => animate(rat1, { alpha: 1, x: w * 0.28, duration: 2000, easing: 'linear' }), 2400);
  later(() => animate(rat2, { alpha: 1, x: w * 0.68, duration: 2600, easing: 'linear' }), 3200);
  later(() => animate(label, { alpha: [0, 0.65, 0.65, 0], duration: 3000,
    keyframes: [{ alpha: 0 }, { alpha: 0.65, duration: 600 }, { alpha: 0.65, duration: 1500 }, { alpha: 0, duration: 900 }]
  }), 3800);

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    app.ticker.remove(tick);
    drips.destroy(); mist.destroy();
    dropTex.destroy(true); puffTex.destroy(true); sewTex.destroy(true);
    [bg, wallG, pipes, ledge, waterMesh, glow, rat1, rat2, label].forEach(e => e.destroy({ children: true }));
  };
}
