/**
 * TECHNIQUE: Oriented + Stretched Sprites  [sequence]
 *
 * Rotate a sprite to face its velocity direction, then scale it along that axis
 * proportional to speed. The stretch implies motion blur without any actual blur.
 * Faster bullets = longer stretch. At rest = circle.
 *
 * sprite.rotation = Math.atan2(vy, vx)
 * sprite.scaleX   = speed * STRETCH_FACTOR   (along direction of travel)
 * sprite.scaleY   = 0.5                       (compress perpendicular)
 *
 * VFX type: defineSequence — one spray volley (spawn → all bullets leave screen)
 * is a discrete sequence. The storybook loops volleys; the game fires on demand.
 */
import { Container, Graphics, RenderTexture, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { defineSequence } from '@/core/vfx/types';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

const STRETCH = 0.055;
const BULLET_COUNT = 18;

interface Bullet { sprite: Sprite; vx: number; vy: number; speed: number; }

function makeBulletCore(): RenderTexture {
  const g = new Graphics();
  g.circle(0, 0, 4).fill(0xffffff);
  g.circle(0, 0, 6).fill({ color: 0xffffcc, alpha: 0.3 });
  return app.renderer.generateTexture(g);
}

/** Bullet spray sequence: spawn volley, physics loop, resolve when all bullets leave screen. */
const bulletSpraySequence = defineSequence<{ cx: number; cy: number; w: number; h: number }>({
  kind: 'sequence',
  id: 'bulletSprayDemo',
  build({ cx, cy, w, h }, { layer }) {
    return new Promise<void>((resolve) => {
      const tex = makeBulletCore();
      const bullets: Bullet[] = [];

      for (let i = 0; i < BULLET_COUNT; i++) {
        const angle = (i / BULLET_COUNT) * Math.PI * 2;
        const speed = 30 + (i / BULLET_COUNT) * 200;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.x = cx;
        sprite.y = cy;
        sprite.tint = i % 3 === 0 ? 0xffff88 : i % 3 === 1 ? 0x88ffcc : 0xff8888;
        layer.addChild(sprite);
        bullets.push({ sprite, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed });
      }

      const margin = 20;
      const tick = (dt: { deltaMS: number }) => {
        const delta = dt.deltaMS / 1000;
        let anyOn = false;
        bullets.forEach((b) => {
          b.sprite.x += b.vx * delta;
          b.sprite.y += b.vy * delta;
          b.sprite.rotation = Math.atan2(b.vy, b.vx);
          b.sprite.scaleX = Math.max(1, b.speed * STRETCH);
          b.sprite.scaleY = 0.45;
          if (
            b.sprite.x >= -margin && b.sprite.x <= w + margin &&
            b.sprite.y >= -margin && b.sprite.y <= h + margin
          ) anyOn = true;
        });
        if (!anyOn) {
          app.ticker.remove(tick);
          bullets.forEach((b) => b.sprite.destroy());
          tex.destroy(true);
          resolve();
        }
      };
      app.ticker.add(tick);
    });
  },
});

export function bulletStretch(root: Container, w: number, h: number): () => void {
  let cancelled = false;

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080808);
  root.addChild(bg);

  const crosshair = new Graphics();
  crosshair.moveTo(cx - 8, cy).lineTo(cx + 8, cy).stroke({ color: 0x334433, width: 1 });
  crosshair.moveTo(cx, cy - 8).lineTo(cx, cy + 8).stroke({ color: 0x334433, width: 1 });
  root.addChild(crosshair);

  const label = new Text({
    text: 'ORIENTED SPRITE — rotation + scaleX = motion blur illusion  [sequence]',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a5a2a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'bulletSpraySequence  ·  defineSequence  ·  slow ←              → fast',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x2a4a2a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 14;
  root.addChild(labelB);

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
      await bulletSpraySequence.build({ cx, cy, w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 400));
    }
  };

  loop();

  return () => {
    cancelled = true;
    [bg, crosshair, label, labelB].forEach((e) => e.destroy());
  };
}
