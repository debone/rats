/**
 * MESH CUTSCENE: Toxic Leak  [sequence]
 *
 * A cracked overhead pipe leaks a dangerous substance. Each leak is a
 * MeshRope whose points hang vertically from the pipe, growing longer
 * over time. When a tendril reaches max length it "drops" — spawning a
 * falling particle — and resets shorter.
 *
 * The goo texture is a glowing cross-section: bright toxic green at the
 * rope centre, dark and transparent at the edges. This makes each tendril
 * look thick, translucent, and viscous.
 *
 * A MeshRope is essential here: a Graphics line would look like a stick,
 * not a gooey strand. The rope geometry gives the correct soft-tube
 * cross-section at every point along the tendril's length.
 *
 * VFX type: defineSequence — atmosphere + hazard sequence with scheduled beats.
 */
import { animate } from 'animejs';
import { Container, Graphics, MeshRope, Point, Text, Texture } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

const toxicLeakSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'toxicLeak',
  async build(_params, _ctx) { /* storybook drives via loop below */ },
});

const N_DRIPS  = 5;
const N_SEG    = 18;
const MAX_LEN  = 65;
const GROW_SPD = 12;  // px/s

function makeGooTex(): Texture {
  const H = 28;
  const g = new Graphics();
  for (let y = 0; y < H; y++) {
    const v = Math.abs(y / H * 2 - 1);        // 0 centre, 1 edge
    const a = Math.pow(Math.max(0, 1 - v), 1.4);
    const t = Math.max(0, 1 - v * 1.5);
    const r = Math.round(lerp(0x22, 0xcc, t));
    const gg = 0xff;
    const b  = Math.round(lerp(0x00, 0x44, t));
    g.rect(0, y, 4, 1).fill({ color: (r << 16) | (gg << 8) | b, alpha: a });
  }
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface Drip {
  anchorX: number;
  len: number;
  maxLen: number;
  wobblePhase: number;
  pts: Point[];
  rope: MeshRope;
}

interface Drop { x: number; y: number; vy: number; age: number; }

export function toxicLeak(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) =>
    timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms));

  const PIPE_Y = h * 0.22;

  // Dark industrial background
  const bg = new Graphics().rect(0, 0, w, h).fill(0x050608);
  bg.alpha = 0;
  root.addChild(bg);

  // Background wall grime
  const grimeG = new Graphics();
  for (let y = 0; y < h; y += 3)
    grimeG.rect(0, y, w, 1).fill({ color: 0x080a06, alpha: (y / h) * 0.4 });
  grimeG.alpha = 0;
  root.addChild(grimeG);

  // Ceiling pipe with crack
  const pipeG = new Graphics();
  pipeG.roundRect(0, PIPE_Y - 10, w, 20, 4).fill(0x2a2210).stroke({ color: 0x0a0804, width: 1 });
  // Pipe seams
  for (let x = 30; x < w; x += 50)
    pipeG.rect(x, PIPE_Y - 10, 3, 20).fill({ color: 0x0a0804, alpha: 0.7 });
  // Rust/cracks at drip points
  const crackG = new Graphics();
  pipeG.alpha = 0;
  root.addChild(pipeG, crackG);

  // Hazard label
  const hazardBg = new Graphics()
    .rect(w * 0.5 - 90, 8, 180, 14).fill({ color: 0xffcc00, alpha: 0.9 });
  const hazardText = new Text({
    text: '⚠  BIOHAZARD — TOXIC SUBSTANCE DETECTED  ⚠',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x000000, fontWeight: 'bold' },
  });
  hazardText.anchor.set(0.5, 0); hazardText.x = w / 2; hazardText.y = 9;
  hazardBg.alpha = 0; hazardText.alpha = 0;
  root.addChild(hazardBg, hazardText);

  // Floor stain that grows
  const stainG = new Graphics();
  stainG.alpha = 0;
  root.addChild(stainG);

  // ── MESH: Toxic drip tendrils ─────────────────────────────────────────
  const gooTex = makeGooTex();
  const drips: Drip[] = [];
  const drops: Drop[] = [];
  const dropG = new Graphics();
  root.addChild(dropG);

  // Anchor positions spread along the pipe
  const anchors = [w * 0.15, w * 0.3, w * 0.5, w * 0.68, w * 0.84];
  for (let i = 0; i < N_DRIPS; i++) {
    const pts = Array.from({ length: N_SEG }, () => new Point(anchors[i], PIPE_Y));
    const rope = new MeshRope({ texture: gooTex, points: pts });
    rope.tint = 0xaaffaa;
    rope.alpha = 0;
    root.addChild(rope);
    crackG.circle(anchors[i], PIPE_Y + 9, 4).fill({ color: 0x88ff44, alpha: 0.25 });
    drips.push({ anchorX: anchors[i], len: 2 + i * 8, maxLen: MAX_LEN * (0.7 + Math.random() * 0.5), wobblePhase: i * 1.3, pts, rope });
  }

  // Toxic puddle particles (simple Graphics dots)
  const puddleG = new Graphics();
  puddleG.alpha = 0;
  root.addChild(puddleG);

  let t = 0;
  const puddles: { x: number; r: number }[] = [];

  const tick = (dt: { deltaMS: number }) => {
    t += dt.deltaMS / 1000;
    const s = dt.deltaMS / 1000;

    for (const d of drips) {
      // Grow tendril
      d.len += GROW_SPD * s * (0.6 + 0.4 * Math.random());
      if (d.len > d.maxLen) {
        // Drop! Spawn a falling drop
        drops.push({ x: d.anchorX + (Math.random() - 0.5) * 8, y: PIPE_Y + d.maxLen, vy: 40 + Math.random() * 60, age: 0 });
        d.len = d.maxLen * 0.25; // snap back shorter
        // Grow puddle on floor
        const fx = d.anchorX + (Math.random() - 0.5) * 14;
        const existing = puddles.find(p => Math.abs(p.x - fx) < 18);
        if (existing) existing.r = Math.min(existing.r + 2, 22);
        else puddles.push({ x: fx, r: 4 });
      }

      // Update rope points
      for (let i = 0; i < N_SEG; i++) {
        const frac = i / (N_SEG - 1);
        const wobble = Math.sin(frac * Math.PI * 2.5 + t * 2.1 + d.wobblePhase) * frac * 3.5;
        d.pts[i].x = d.anchorX + wobble;
        d.pts[i].y = PIPE_Y + frac * d.len;
      }
    }

    // Falling drops
    dropG.clear();
    for (let di = drops.length - 1; di >= 0; di--) {
      const dr = drops[di];
      dr.age += s; dr.vy += 200 * s; dr.y += dr.vy * s;
      if (dr.y > h + 10) { drops.splice(di, 1); continue; }
      const alpha = Math.max(0, 0.9 - dr.age * 0.5);
      dropG.ellipse(dr.x, dr.y, 3, 5).fill({ color: 0x88ff44, alpha });
    }

    // Puddles
    puddleG.clear();
    for (const p of puddles)
      puddleG.ellipse(p.x, h - 4, p.r, p.r * 0.35).fill({ color: 0x44cc22, alpha: 0.5 });
  };

  // Sequence
  animate(bg, { alpha: 1, duration: 700, easing: 'easeIn' });
  later(() => animate(grimeG, { alpha: 1, duration: 1000 }), 300);
  later(() => {
    animate(pipeG, { alpha: 1, duration: 900 });
    animate(crackG, { alpha: [0, 0.7], duration: 1200 });
  }, 900);
  later(() => {
    for (const d of drips)
      animate(d.rope, { alpha: [0, 0.9], duration: 800, delay: Math.random() * 600 });
    animate(puddleG, { alpha: 1, duration: 600 });
    app.ticker.add(tick);
  }, 1800);
  later(() => {
    animate(hazardBg, { alpha: [0, 0.9, 0.9, 0.9, 0], duration: 3000,
      keyframes: [{ alpha: 0 }, { alpha: 0.9, duration: 300 }, { alpha: 0.3, duration: 250 }, { alpha: 0.9, duration: 300 }, { alpha: 0.3, duration: 250 }, { alpha: 0.9, duration: 700 }, { alpha: 0, duration: 1200 }]
    });
    animate(hazardText, { alpha: [0, 1, 1, 0], duration: 3000,
      keyframes: [{ alpha: 0 }, { alpha: 1, duration: 300 }, { alpha: 0.3, duration: 250 }, { alpha: 1, duration: 300 }, { alpha: 0.3, duration: 250 }, { alpha: 1, duration: 700 }, { alpha: 0, duration: 1200 }]
    });
  }, 3200);

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    app.ticker.remove(tick);
    gooTex.destroy(true);
    drips.forEach(d => d.rope.destroy());
    [bg, grimeG, pipeG, crackG, hazardBg, hazardText, stainG, dropG, puddleG].forEach(e => e.destroy({ children: true }));
  };
}
