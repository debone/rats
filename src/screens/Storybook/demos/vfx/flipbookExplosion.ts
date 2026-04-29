/**
 * TECHNIQUE: Flipbook / Spritesheet VFX
 *
 * Pre-draw N frames of an effect at full quality, pack into textures, play back
 * as an AnimatedSprite. The artist controls exactly what every frame looks like.
 * Used by every major game for explosions, hit sparks, fire bursts.
 *
 * Key insight: the frames are baked — no per-frame simulation. Fast and predictable.
 */
import { AnimatedSprite, Container, Graphics, RenderTexture, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

interface FrameDef {
  coreR: number;
  coreColor: number;
  ringR: number;
  ringW: number;
  ringColor: number;
  alpha: number;
}

const FRAME_DEFS: FrameDef[] = [
  { coreR: 4,  coreColor: 0xffffff, ringR: 0,  ringW: 0, ringColor: 0,        alpha: 1.00 }, // flash
  { coreR: 8,  coreColor: 0xffee66, ringR: 12, ringW: 2, ringColor: 0xffcc44, alpha: 0.95 },
  { coreR: 9,  coreColor: 0xff9922, ringR: 16, ringW: 3, ringColor: 0xff6600, alpha: 0.85 },
  { coreR: 8,  coreColor: 0xff5500, ringR: 19, ringW: 4, ringColor: 0xff3300, alpha: 0.75 },
  { coreR: 6,  coreColor: 0xdd2200, ringR: 21, ringW: 4, ringColor: 0xaa1100, alpha: 0.60 },
  { coreR: 4,  coreColor: 0x882200, ringR: 23, ringW: 3, ringColor: 0x661100, alpha: 0.40 },
  { coreR: 3,  coreColor: 0x441100, ringR: 25, ringW: 2, ringColor: 0x330800, alpha: 0.22 },
  { coreR: 2,  coreColor: 0x221100, ringR: 0,  ringW: 0, ringColor: 0,        alpha: 0.10 }, // smoke
];

function makeExplosionFrames(): RenderTexture[] {
  return FRAME_DEFS.map((f) => {
    const g = new Graphics();
    if (f.coreR > 0) {
      g.circle(0, 0, f.coreR).fill({ color: f.coreColor, alpha: f.alpha });
    }
    if (f.ringR > 0) {
      g.circle(0, 0, f.ringR).stroke({ color: f.ringColor, width: f.ringW, alpha: f.alpha * 0.7 });
    }
    const tex = app.renderer.generateTexture(g);
    g.destroy();
    return tex;
  });
}

export function flipbookExplosion(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let spawnInterval: ReturnType<typeof setInterval> | undefined;
  const frames = makeExplosionFrames();
  const active: AnimatedSprite[] = [];

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x0a0808);
  root.addChild(bg);

  const label = new Text({
    text: 'FLIPBOOK — 8 pre-drawn frames',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x6a4a2a, letterSpacing: 2 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  // Show the raw frame strip along the bottom so the technique is visible
  const STRIP_Y = h - 22;
  frames.forEach((tex, i) => {
    const preview = new AnimatedSprite([tex]);
    preview.anchor.set(0.5);
    preview.x = 14 + i * (w - 28) / (frames.length - 1);
    preview.y = STRIP_Y;
    preview.scale.set(0.9);
    root.addChild(preview);

    const num = new Text({
      text: `${i}`,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 5, fill: 0x4a3a2a },
    });
    num.anchor.set(0.5);
    num.x = preview.x;
    num.y = STRIP_Y + 10;
    root.addChild(num);
  });

  const spawnExplosion = () => {
    if (cancelled) return;
    const anim = new AnimatedSprite(frames);
    anim.anchor.set(0.5);
    anim.x = 20 + Math.random() * (w - 40);
    anim.y = 20 + Math.random() * (h - 60);
    anim.animationSpeed = 0.45;
    anim.loop = false;
    anim.scale.set(1.4 + Math.random() * 1.2);
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

  spawnInterval = setInterval(spawnExplosion, 600);
  spawnExplosion();

  return () => {
    cancelled = true;
    clearInterval(spawnInterval);
    active.forEach((a) => a.destroy());
    frames.forEach((t) => t.destroy(true));
    [bg, label].forEach((e) => e.destroy());
  };
}
