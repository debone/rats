/**
 * MESH CUTSCENE: Tunnel Collapse  [sequence]
 *
 * Structural failure sequence. A MeshPlane represents the tunnel wall.
 * Vertex displacement starts subtle (trembling) then escalates through
 * three phases to total collapse.
 *
 * Phase 1 — ambient: flat wall, water drips, ambient flicker.
 * Phase 2 — warning: alarms fire, text flashes, wall begins micro-trembling.
 * Phase 3 — collapse: amplitude explodes, per-vertex chaos, debris shower.
 * Phase 4 — rubble: extreme displacement locked, dust settles.
 *
 * The MeshPlane vertex displacement is the ONLY way to do this: a Sprite
 * would have to be swapped for a completely different image. The mesh
 * distorts continuously with no art assets needed.
 *
 * VFX type: defineSequence — dramatic 4-phase collapse with escalating mesh distortion.
 */
import { animate } from 'animejs';
import { Container, Graphics, Mesh, PlaneGeometry, Text, Texture } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeShardTexture, makeSoftPuffTexture } from '../particleTextures';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

const tunnelCollapseSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'tunnelCollapse',
  async build(_params, _ctx) { /* storybook drives via loop below */ },
});

const COLS = 40;
const ROWS = 24;

function makeWallTex(tw: number, th: number): Texture {
  const g = new Graphics();
  g.rect(0, 0, tw, th).fill(0x181410);
  const BW = tw / 8, BH = th / 12;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      const off = (row % 2) * (BW / 2);
      g.rect(col * BW + off, row * BH, BW - 1.5, BH - 1.5)
        .fill([0x1e1a12, 0x1a1610, 0x16120e][col % 3]);
      // Occasional stain
      if ((row * 8 + col) % 7 === 0)
        g.rect(col * BW + off + 2, row * BH + 2, BW * 0.6, BH * 0.5)
          .fill({ color: 0x0c0a06, alpha: 0.35 });
    }
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function tunnelCollapse(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) =>
    timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms));

  let collapseAmp = 0;
  let collapsePhase = 0;  // 0=normal, 1=tremble, 2=collapsing, 3=rubble
  const rubbleOffsets = new Float32Array(COLS * ROWS * 2); // locked displacement at collapse

  const bg = new Graphics().rect(0, 0, w, h).fill(0x060504);
  bg.alpha = 0;
  root.addChild(bg);

  // ── MESH: Wall ───────────────────────────────────────────────────────
  const wallTex = makeWallTex(320, 240);
  const geo = new PlaneGeometry({ width: w, height: h, verticesX: COLS, verticesY: ROWS });
  const wall = new Mesh({ geometry: geo, texture: wallTex });
  wall.alpha = 0;
  root.addChild(wall);

  const { buffer } = geo.getAttribute('aPosition');
  const restX = new Float32Array(COLS * ROWS);
  const restY = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) {
    restX[i] = buffer.data[i * 2];
    restY[i] = buffer.data[i * 2 + 1];
  }

  // Crack overlay (drawn progressively)
  const crackG = new Graphics();
  root.addChild(crackG);
  const CRACKS = [
    [[w*0.4, h*0.2], [w*0.35, h*0.5], [w*0.28, h*0.75]],
    [[w*0.4, h*0.2], [w*0.55, h*0.45], [w*0.62, h*0.7]],
    [[w*0.6, h*0.1], [w*0.65, h*0.35]],
    [[w*0.2, h*0.3], [w*0.15, h*0.6]],
    [[w*0.75, h*0.4], [w*0.8, h*0.65], [w*0.7, h*0.85]],
  ];
  let crackProgress = 0;

  // Red alarm overlay
  const alarmG = new Graphics().rect(0, 0, w, h).fill({ color: 0xff1100, alpha: 0.12 });
  alarmG.alpha = 0;
  root.addChild(alarmG);

  // Warning text
  const warnText = new Text({
    text: '! STRUCTURAL FAILURE — EVACUATE IMMEDIATELY !',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0xff3300, fontWeight: 'bold', letterSpacing: 1 },
  });
  warnText.anchor.set(0.5); warnText.x = w / 2; warnText.y = h * 0.12;
  warnText.alpha = 0;
  root.addChild(warnText);

  // Dust particles
  const dustTex = makeSoftPuffTexture();
  const shardTex = makeShardTexture();
  const dust = new ParticleEmitter({
    texture: dustTex, maxParticles: 60, emitting: false,
    lifespan: { min: 1200, max: 3000 }, speed: { min: 8, max: 35 },
    angle: { min: 220, max: 320 }, x: { min: -w/2, max: w/2 },
    scale: { start: { min: 0.2, max: 0.9 }, end: 1.8 },
    alpha: { start: 0.5, end: 0 },
    tint: { start: 0x886644, end: 0x060504 },
  });
  dust.x = w / 2; dust.y = h / 2;
  root.addChild(dust.container);

  const debris = new ParticleEmitter({
    texture: shardTex, maxParticles: 40, emitting: false,
    lifespan: { min: 800, max: 1800 }, speed: { min: 80, max: 220 },
    angle: { min: 180, max: 360 }, x: { min: -w/2, max: w/2 },
    accelerationY: 350,
    scale: { start: { min: 0.4, max: 1.0 }, end: 0.1 },
    alpha: { start: 1, end: 0 },
    tint: { start: 0x554433, end: 0x221810 },
  });
  debris.x = w / 2; debris.y = h * 0.4;
  root.addChild(debris.container);

  let t = 0;
  const tick = (dt: { deltaMS: number }) => {
    t += dt.deltaMS / 1000;

    // Draw cracks progressively
    if (collapsePhase >= 1 && crackProgress < 1) {
      crackProgress = Math.min(1, crackProgress + dt.deltaMS / 2500);
      crackG.clear();
      for (const crack of CRACKS) {
        const steps = crack.length - 1;
        for (let s = 0; s < steps; s++) {
          const segStart = s / steps;
          const segEnd = (s + 1) / steps;
          if (crackProgress < segStart) continue;
          const frac = Math.min(1, (crackProgress - segStart) / (segEnd - segStart));
          const [x1, y1] = crack[s], [x2, y2] = crack[s + 1];
          crackG.moveTo(x1, y1).lineTo(x1 + (x2-x1)*frac, y1 + (y2-y1)*frac)
            .stroke({ color: 0x000000, width: 2 + s, alpha: 0.7 });
          crackG.moveTo(x1, y1).lineTo(x1 + (x2-x1)*frac, y1 + (y2-y1)*frac)
            .stroke({ color: 0x443322, width: 1, alpha: 0.4 });
        }
      }
    }

    // Alarm pulse
    if (collapsePhase >= 1)
      alarmG.alpha = (Math.sin(t * 5.5) > 0) ? 0.10 : 0;

    // Wall displacement
    for (let i = 0; i < COLS * ROWS; i++) {
      let dx = 0, dy = 0;
      if (collapsePhase === 1) {
        // Micro-trembling
        dx = Math.sin(t * 28 + i * 0.3) * collapseAmp;
        dy = Math.sin(t * 31 + i * 0.5) * collapseAmp;
      } else if (collapsePhase === 2) {
        // Violent shaking + structural distortion
        const row = Math.floor(i / COLS), col = i % COLS;
        const centerDist = Math.hypot(col / COLS - 0.45, row / ROWS - 0.3);
        dx = Math.sin(t * 22 + i * 0.7) * collapseAmp * (1 + centerDist * 2);
        dy = Math.sin(t * 19 + i * 1.1) * collapseAmp * (1 + centerDist * 2);
        // Also pull toward the "collapse zone"
        dx += (w * 0.45 - restX[i]) * 0.012 * collapseAmp / 8;
        dy += (h * 0.35 - restY[i]) * 0.008 * collapseAmp / 8;
      } else if (collapsePhase === 3) {
        dx = rubbleOffsets[i * 2]     + Math.sin(t * 3 + i) * 1.5;
        dy = rubbleOffsets[i * 2 + 1] + Math.sin(t * 4 + i * 1.3) * 1.5;
      }
      buffer.data[i * 2]     = restX[i] + dx;
      buffer.data[i * 2 + 1] = restY[i] + dy;
    }
    buffer.update();
  };

  // Sequence
  animate(bg, { alpha: 1, duration: 800, easing: 'easeIn' });
  later(() => animate(wall, { alpha: 1, duration: 1400, easing: 'easeOut' }), 400);

  // Warning phase
  later(() => {
    app.ticker.add(tick);
    collapsePhase = 1;
    animate({ v: 0 }, { v: 4, duration: 2500, onUpdate: (a) => collapseAmp = (a.targets[0] as { v: number }).v });
    animate(warnText, { alpha: [0, 1, 0.3, 1, 0.3, 1], duration: 1200,
      keyframes: [{ alpha: 0 }, { alpha: 1, duration: 200 }, { alpha: 0.2, duration: 200 }, { alpha: 1, duration: 200 }, { alpha: 0.2, duration: 200 }, { alpha: 1, duration: 400 }]
    });
  }, 2000);

  // Collapse phase
  later(() => {
    collapsePhase = 2;
    dust.emitting = true;
    animate({ v: 4 }, { v: 28, duration: 2000, onUpdate: (a) => collapseAmp = (a.targets[0] as { v: number }).v });
  }, 4800);

  later(() => {
    debris.emitting = true;
  }, 5400);

  // Rubble phase — lock displacement
  later(() => {
    collapsePhase = 3;
    for (let i = 0; i < COLS * ROWS; i++) {
      const row = Math.floor(i / COLS), col = i % COLS;
      const centerDist = Math.hypot(col / COLS - 0.45, row / ROWS - 0.3);
      rubbleOffsets[i * 2]     = (Math.random() - 0.5) * 60 * (0.2 + centerDist);
      rubbleOffsets[i * 2 + 1] = (Math.random() - 0.5) * 40 * (0.2 + centerDist) + centerDist * 30;
    }
    collapseAmp = 1;
    dust.emitting = false;
    debris.emitting = false;
  }, 7000);

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    app.ticker.remove(tick);
    dust.destroy(); debris.destroy();
    dustTex.destroy(true); shardTex.destroy(true); wallTex.destroy(true);
    [bg, wall, crackG, alarmG, warnText].forEach(e => e.destroy({ children: true }));
  };
}
