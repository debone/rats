/**
 * TECHNIQUE: Oriented + Stretched Sprites
 *
 * Rotate a sprite to face its velocity direction, then scale it along that axis
 * proportional to speed. The stretch implies motion blur without any actual blur.
 * Faster bullets = longer stretch. At rest = circle.
 *
 * sprite.rotation = Math.atan2(vy, vx)
 * sprite.scaleX   = speed * STRETCH_FACTOR   (along direction of travel)
 * sprite.scaleY   = 0.5                       (compress perpendicular)
 */
import { Container, Graphics, RenderTexture, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const STRETCH = 0.055;
const BULLET_COUNT = 18;

interface Bullet {
  sprite: Sprite;
  vx: number;
  vy: number;
  speed: number;
  active: boolean;
}

function makeBulletCore(): RenderTexture {
  // A circle — stretching turns this into an oval/rod at speed
  const g = new Graphics();
  g.circle(0, 0, 4).fill(0xffffff);
  g.circle(0, 0, 6).fill({ color: 0xffffcc, alpha: 0.3 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function bulletStretch(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tex = makeBulletCore();
  const bullets: Bullet[] = [];

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080808);
  root.addChild(bg);

  // Dim crosshair at center (the "gun")
  const crosshair = new Graphics();
  crosshair
    .moveTo(cx - 8, cy)
    .lineTo(cx + 8, cy)
    .stroke({ color: 0x334433, width: 1 });
  crosshair
    .moveTo(cx, cy - 8)
    .lineTo(cx, cy + 8)
    .stroke({ color: 0x334433, width: 1 });
  root.addChild(crosshair);

  const label = new Text({
    text: 'ORIENTED SPRITE — rotation + scaleX = motion blur illusion',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a5a2a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'slow ←                           → fast',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x2a4a2a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 14;
  root.addChild(labelB);

  // Spawn bullets at different speeds so the stretch is easy to compare
  for (let i = 0; i < BULLET_COUNT; i++) {
    const angle = (i / BULLET_COUNT) * Math.PI * 2;
    // Speed varies per bullet so we see different stretch amounts
    const speed = 30 + (i / BULLET_COUNT) * 200;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.x = cx;
    sprite.y = cy;
    sprite.tint = i % 3 === 0 ? 0xffff88 : i % 3 === 1 ? 0x88ffcc : 0xff8888;
    root.addChild(sprite);

    bullets.push({ sprite, vx, vy, speed, active: true });
  }

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;

    bullets.forEach((b) => {
      if (!b.active) return;

      b.sprite.x += b.vx * delta;
      b.sprite.y += b.vy * delta;

      // Orient to velocity
      b.sprite.rotation = Math.atan2(b.vy, b.vx);

      // Stretch along direction of travel — the core technique
      b.sprite.scaleX = Math.max(1, b.speed * STRETCH);
      b.sprite.scaleY = 0.45;

      // Respawn when off screen
      const margin = 20;
      if (
        b.sprite.x < -margin || b.sprite.x > w + margin ||
        b.sprite.y < -margin || b.sprite.y > h + margin
      ) {
        b.sprite.x = cx;
        b.sprite.y = cy;
      }
    });
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    app.ticker.remove(tick);
    tex.destroy(true);
    bullets.forEach((b) => b.sprite.destroy());
    [bg, crosshair, label, labelB].forEach((e) => e.destroy());
  };
}
