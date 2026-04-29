/**
 * TECHNIQUE: Flipbook — water ripple / shockwave ring
 *
 * Same technique as flipbookExplosion but for a different effect.
 * Notice the difference: only the ring frame data changes, no simulation code.
 * Swapping the frame strip is how you make completely different effects
 * from the same AnimatedSprite playback infrastructure.
 */
import { AnimatedSprite, Container, Graphics, RenderTexture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface RippleFrame { r: number; width: number; alpha: number; color: number; }

const RIPPLE_FRAMES: RippleFrame[] = [
  { r: 3,  width: 3.0, alpha: 0.9, color: 0xaaddff },
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
    // Outer diffuse ring
    g.circle(0, 0, f.r + 2).stroke({ color: f.color, width: f.width * 2, alpha: f.alpha * 0.25 });
    // Main ring
    g.circle(0, 0, f.r).stroke({ color: f.color, width: f.width, alpha: f.alpha });
    // Inner bright edge
    g.circle(0, 0, Math.max(1, f.r - 1)).stroke({ color: 0xffffff, width: 0.5, alpha: f.alpha * 0.4 });
    const tex = app.renderer.generateTexture(g);
    g.destroy();
    return tex;
  });
}

export function flipbookRipple(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let spawnInterval: ReturnType<typeof setInterval> | undefined;
  const frames = makeRippleFrames();
  const active: AnimatedSprite[] = [];

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060c14);
  root.addChild(bg);

  // Standing water surface suggestion
  const water = new Graphics();
  for (let y = h * 0.5; y < h - 20; y += 6) {
    water
      .moveTo(0, y)
      .lineTo(w, y)
      .stroke({ color: 0x0a1828, width: 1 });
  }
  root.addChild(water);

  const label = new Text({
    text: 'FLIPBOOK — ripple ring, 8 frames',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a4a6a, letterSpacing: 2 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const spawnRipple = () => {
    if (cancelled) return;
    const anim = new AnimatedSprite(frames);
    anim.anchor.set(0.5);
    // Ripples spawn in the lower "water" half
    anim.x = 20 + Math.random() * (w - 40);
    anim.y = h * 0.5 + Math.random() * (h * 0.4);
    anim.animationSpeed = 0.3;
    anim.loop = false;
    anim.scale.set(0.8 + Math.random() * 0.8);
    anim.onComplete = () => {
      root.removeChild(anim);
      anim.destroy();
      const idx = active.indexOf(anim);
      if (idx >= 0) active.splice(idx, 1);
    };
    root.addChild(anim);
    active.push(anim);
    anim.play();
  };

  spawnInterval = setInterval(spawnRipple, 500);
  spawnRipple();
  setTimeout(spawnRipple, 250);

  return () => {
    cancelled = true;
    clearInterval(spawnInterval);
    active.forEach((a) => a.destroy());
    frames.forEach((t) => t.destroy(true));
    [bg, water, label].forEach((e) => e.destroy());
  };
}
