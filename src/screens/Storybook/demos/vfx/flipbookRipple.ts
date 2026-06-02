/**
 * TECHNIQUE: Flipbook — water ripple / shockwave ring  [sequence]
 *
 * Same technique as flipbookExplosion but for a different effect.
 * Notice the difference: only the ring frame data changes, no simulation code.
 * Swapping the frame strip is how you make completely different effects
 * from the same AnimatedSprite playback infrastructure.
 *
 * VFX type: defineSequence — each ripple spawn is a timed one-shot moment.
 * Multiple ripples can be playing simultaneously (each is an independent sequence instance).
 */
import { AnimatedSprite, Container, Graphics, RenderTexture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

interface RippleFrame { r: number; width: number; alpha: number; color: number; }

const RIPPLE_FRAMES: RippleFrame[] = [
  { r: 3,  width: 3.0, alpha: 0.9,  color: 0xaaddff },
  { r: 7,  width: 2.5, alpha: 0.85, color: 0x88ccff },
  { r: 12, width: 2.0, alpha: 0.75, color: 0x66aaff },
  { r: 16, width: 1.8, alpha: 0.60, color: 0x4488dd },
  { r: 20, width: 1.5, alpha: 0.45, color: 0x336699 },
  { r: 24, width: 1.2, alpha: 0.28, color: 0x224477 },
  { r: 27, width: 1.0, alpha: 0.14, color: 0x112244 },
  { r: 30, width: 0.8, alpha: 0.05, color: 0x001122 },
];

function makeRippleFrames(): RenderTexture[] {
  return RIPPLE_FRAMES.map((f) => {
    const g = new Graphics();
    g.circle(0, 0, f.r + 2).stroke({ color: f.color, width: f.width * 2, alpha: f.alpha * 0.25 });
    g.circle(0, 0, f.r).stroke({ color: f.color, width: f.width, alpha: f.alpha });
    g.circle(0, 0, Math.max(1, f.r - 1)).stroke({ color: 0xffffff, width: 0.5, alpha: f.alpha * 0.4 });
    const tex = app.renderer.generateTexture(g);
    g.destroy();
    return tex;
  });
}

/** Inline sequence: spawn one ripple AnimatedSprite, wait for it to complete. */
const rippleSpawnSequence = defineSequence<{ x: number; y: number; scale: number; layer: Container; frames: RenderTexture[] }>({
  kind: 'sequence',
  id: 'rippleSpawnDemo',
  build({ x, y, scale, layer, frames }) {
    return new Promise<void>((resolve) => {
      const anim = new AnimatedSprite(frames);
      anim.anchor.set(0.5);
      anim.x = x;
      anim.y = y;
      anim.animationSpeed = 0.3;
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

export function flipbookRipple(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let spawnInterval: ReturnType<typeof setInterval> | undefined;
  const frames = makeRippleFrames();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060c14);
  root.addChild(bg);

  const water = new Graphics();
  for (let y = h * 0.5; y < h - 20; y += 6) {
    water.moveTo(0, y).lineTo(w, y).stroke({ color: 0x0a1828, width: 1 });
  }
  root.addChild(water);

  const label = new Text({
    text: 'FLIPBOOK — ripple ring, 8 frames  [sequence]',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a4a6a, letterSpacing: 2 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'rippleSpawnSequence  ·  defineSequence  ·  same AnimatedSprite infra, different frames',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x1a3050, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  const ctx: SequenceContext = {
    camera: null as any,
    layer: root,
    stage: root,
    size: { width: w, height: h },
    cutscene: () => Promise.resolve(),
    timeline: () => createTimeline(),
  };

  const spawnRipple = () => {
    if (cancelled) return;
    rippleSpawnSequence.build(
      { x: 20 + Math.random() * (w - 40), y: h * 0.5 + Math.random() * (h * 0.4), scale: 0.8 + Math.random() * 0.8, layer: root, frames },
      ctx,
    );
  };

  spawnInterval = setInterval(spawnRipple, 500);
  spawnRipple();
  setTimeout(spawnRipple, 250);

  return () => {
    cancelled = true;
    clearInterval(spawnInterval);
    frames.forEach((t) => t.destroy(true));
    [bg, water, label, labelB].forEach((e) => e.destroy());
  };
}
