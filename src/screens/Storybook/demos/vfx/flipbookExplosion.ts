/**
 * TECHNIQUE: Flipbook / Spritesheet VFX  [sequence]
 *
 * Pre-draw N frames of an effect at full quality, pack into textures, play back
 * as an AnimatedSprite. The artist controls exactly what every frame looks like.
 * Used by every major game for explosions, hit sparks, fire bursts.
 *
 * Key insight: the frames are baked — no per-frame simulation. Fast and predictable.
 *
 * VFX type: defineSequence — each explosion spawn is a choreographed moment.
 * The storybook loops spawning; the game would call this for each brick break,
 * enemy death, etc.
 */
import { AnimatedSprite, Container, Graphics, RenderTexture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

interface FrameDef { coreR: number; coreColor: number; ringR: number; ringW: number; ringColor: number; alpha: number; }

const FRAME_DEFS: FrameDef[] = [
  { coreR: 4,  coreColor: 0xffffff, ringR: 0,  ringW: 0, ringColor: 0,        alpha: 1.00 },
  { coreR: 8,  coreColor: 0xffee66, ringR: 12, ringW: 2, ringColor: 0xffcc44, alpha: 0.95 },
  { coreR: 9,  coreColor: 0xff9922, ringR: 16, ringW: 3, ringColor: 0xff6600, alpha: 0.85 },
  { coreR: 8,  coreColor: 0xff5500, ringR: 19, ringW: 4, ringColor: 0xff3300, alpha: 0.75 },
  { coreR: 6,  coreColor: 0xdd2200, ringR: 21, ringW: 4, ringColor: 0xaa1100, alpha: 0.60 },
  { coreR: 4,  coreColor: 0x882200, ringR: 23, ringW: 3, ringColor: 0x661100, alpha: 0.40 },
  { coreR: 3,  coreColor: 0x441100, ringR: 25, ringW: 2, ringColor: 0x330800, alpha: 0.22 },
  { coreR: 2,  coreColor: 0x221100, ringR: 0,  ringW: 0, ringColor: 0,        alpha: 0.10 },
];

function makeExplosionFrames(): RenderTexture[] {
  return FRAME_DEFS.map((f) => {
    const g = new Graphics();
    if (f.coreR > 0) g.circle(0, 0, f.coreR).fill({ color: f.coreColor, alpha: f.alpha });
    if (f.ringR > 0) g.circle(0, 0, f.ringR).stroke({ color: f.ringColor, width: f.ringW, alpha: f.alpha * 0.7 });
    const tex = app.renderer.generateTexture(g);
    g.destroy();
    return tex;
  });
}

/** Inline sequence: spawn one explosion AnimatedSprite, wait for it to complete. */
const explosionSpawnSequence = defineSequence<{ x: number; y: number; scale: number; layer: Container; frames: RenderTexture[] }>({
  kind: 'sequence',
  id: 'explosionSpawnDemo',
  build({ x, y, scale, layer, frames }) {
    return new Promise<void>((resolve) => {
      const anim = new AnimatedSprite(frames);
      anim.anchor.set(0.5);
      anim.x = x;
      anim.y = y;
      anim.animationSpeed = 0.45;
      anim.loop = false;
      anim.scale.set(scale);
      anim.onComplete = () => {
        anim.destroy();
        resolve();
      };
      layer.addChild(anim);
      anim.play();
    });
  },
});

export function flipbookExplosion(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let spawnInterval: ReturnType<typeof setInterval> | undefined;
  const frames = makeExplosionFrames();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x0a0808);
  root.addChild(bg);

  const label = new Text({
    text: 'FLIPBOOK — 8 pre-drawn frames  [sequence]',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x6a4a2a, letterSpacing: 2 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'explosionSpawnSequence  ·  defineSequence  ·  AnimatedSprite playback = baked frames',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x4a3020, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  const STRIP_Y = h - 22;
  frames.forEach((tex, i) => {
    const preview = new AnimatedSprite([tex]);
    preview.anchor.set(0.5);
    preview.x = 14 + i * (w - 28) / (frames.length - 1);
    preview.y = STRIP_Y;
    preview.scale.set(0.9);
    root.addChild(preview);
    const num = new Text({ text: `${i}`, style: { ...TEXT_STYLE_DEFAULT, fontSize: 5, fill: 0x4a3a2a } });
    num.anchor.set(0.5);
    num.x = preview.x;
    num.y = STRIP_Y + 10;
    root.addChild(num);
  });

  const ctx: SequenceContext = {
    camera: null as any,
    layer: root,
    stage: root,
    size: { width: w, height: h },
    cutscene: () => Promise.resolve(),
    timeline: () => createTimeline(),
  };

  const spawnExplosion = () => {
    if (cancelled) return;
    explosionSpawnSequence.build(
      { x: 20 + Math.random() * (w - 40), y: 20 + Math.random() * (h - 60), scale: 1.4 + Math.random() * 1.2, layer: root, frames },
      ctx,
    );
  };

  spawnInterval = setInterval(spawnExplosion, 600);
  spawnExplosion();

  return () => {
    cancelled = true;
    clearInterval(spawnInterval);
    frames.forEach((t) => t.destroy(true));
    [bg, label, labelB].forEach((e) => e.destroy());
  };
}
