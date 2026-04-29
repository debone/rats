/**
 * TECHNIQUE: Oriented Sprite — projectile with gravity
 *
 * rotation = Math.atan2(vy, vx) orients the arrow nose to its velocity.
 * Gravity adds to vy each frame, bending the arc downward, so the nose
 * continuously dips — a subtle detail that reads as realistic physics.
 *
 * Unlike bulletStretch: the arrow has a real shape so no scaling illusion
 * is needed. Pure rotation following velocity is enough.
 * Impact: flash + debris spray (screen-space compositing pattern).
 */
import { Container, Graphics, RenderTexture, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const GRAVITY = 220;

interface Arrow {
  sprite: Sprite;
  vx: number;
  vy: number;
  active: boolean;
}

function makeArrowTexture(): RenderTexture {
  const g = new Graphics();
  // Shaft — drawn pointing right so rotation=0 means "facing right"
  g.rect(-11, -1.5, 14, 3).fill(0xffffff);
  // Arrowhead
  g.poly([3, -4.5, 13, 0, 3, 4.5]).fill(0xffffff);
  // Fletching wings at tail
  g.poly([-11, -1.5, -16, -6, -13, -1.5]).fill({ color: 0xdddddd, alpha: 0.85 });
  g.poly([-11, 1.5, -16, 6, -13, 1.5]).fill({ color: 0xdddddd, alpha: 0.85 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function makeImpactFlash(root: Container, x: number, y: number): () => void {
  let age = 0;
  let done = false;

  const flash = new Graphics();
  root.addChild(flash);

  const ring = new Graphics();
  root.addChild(ring);

  const tick = (dt: { deltaMS: number }) => {
    if (done) return;
    age += dt.deltaMS;

    // Flash: instant bright circle, decays in 120ms
    const fa = Math.max(0, 1 - age / 120);
    flash.clear();
    if (fa > 0) {
      flash.circle(x, y, 18 * (1 - fa) + 4).fill({ color: 0xffffff, alpha: fa * 0.8 });
      flash.circle(x, y, 8).fill({ color: 0xffffaa, alpha: fa });
    }

    // Ring: expands from 0 → 30px over 350ms, fades from 150ms
    const rProgress = Math.min(1, age / 350);
    const ra = Math.max(0, 1 - Math.max(0, age - 150) / 200);
    ring.clear();
    if (ra > 0) {
      ring
        .circle(x, y, 4 + rProgress * 26)
        .stroke({ color: 0xffcc44, width: 2, alpha: ra * 0.7 });
      ring
        .circle(x, y, 2 + rProgress * 14)
        .stroke({ color: 0xffffff, width: 1, alpha: ra * 0.4 });
    }

    if (age > 400) {
      done = true;
      app.ticker.remove(tick);
      flash.destroy();
      ring.destroy();
    }
  };
  app.ticker.add(tick);

  return () => {
    done = true;
    app.ticker.remove(tick);
    if (!flash.destroyed) flash.destroy();
    if (!ring.destroyed) ring.destroy();
  };
}

export function arrowFlight(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tex = makeArrowTexture();
  const arrows: Arrow[] = [];
  const cleanupEffects: Array<() => void> = [];

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x060a08);
  root.addChild(bg);

  // Ground line
  const ground = new Graphics();
  ground.moveTo(0, h - 18).lineTo(w, h - 18).stroke({ color: 0x223322, width: 1 });
  root.addChild(ground);

  // Trajectory ghost lines (drawn once per arrow for context)
  const ghostLines = new Graphics();
  root.addChild(ghostLines);

  const label = new Text({
    text: 'ORIENTED SPRITE — rotation tracks velocity (gravity bends the arc)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a5a2a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'nose dips as vy grows — no artist keyframing needed',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x1a3a1a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  const LAUNCH_CONFIGS = [
    { vx: 90,  vy: -80,  tint: 0x88ffaa },
    { vx: 140, vy: -110, tint: 0xffee88 },
    { vx: 200, vy: -130, tint: 0xff9966 },
    { vx: 260, vy: -150, tint: 0xaaccff },
  ];

  const spawnArrow = (idx: number) => {
    if (cancelled) return;
    const cfg = LAUNCH_CONFIGS[idx % LAUNCH_CONFIGS.length];
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.x = 16;
    sprite.y = h - 18;
    sprite.tint = cfg.tint;
    root.addChild(sprite);
    arrows.push({ sprite, vx: cfg.vx, vy: cfg.vy, active: true });
  };

  // Stagger launches
  for (let i = 0; i < LAUNCH_CONFIGS.length; i++) {
    timer = setTimeout(() => spawnArrow(i), i * 320);
  }

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;

    arrows.forEach((a) => {
      if (!a.active) return;

      a.vy += GRAVITY * delta;

      a.sprite.x += a.vx * delta;
      a.sprite.y += a.vy * delta;

      // Orient to velocity — the entire technique in one line
      a.sprite.rotation = Math.atan2(a.vy, a.vx);

      const groundY = h - 18;
      if (a.sprite.y >= groundY) {
        a.sprite.y = groundY;
        a.active = false;
        const fx = a.sprite.x;
        const fy = groundY;
        // Sink arrow into ground
        a.sprite.rotation = Math.PI / 2 * 0.15 + Math.atan2(a.vy, a.vx) * 0.1;
        a.sprite.y = groundY + 3;

        const c = makeImpactFlash(root, fx, fy);
        cleanupEffects.push(c);
      }

      if (a.sprite.x > w + 20) {
        a.active = false;
        const c = makeImpactFlash(root, w + 10, a.sprite.y);
        cleanupEffects.push(c);
      }
    });

    // Restart loop when all arrows are done
    const allDone = arrows.every((a) => !a.active);
    if (allDone && arrows.length === LAUNCH_CONFIGS.length) {
      arrows.forEach((a) => a.sprite.destroy());
      arrows.length = 0;
      cleanupEffects.forEach((fn) => fn());
      cleanupEffects.length = 0;
      if (!cancelled) {
        timer = setTimeout(() => {
          for (let i = 0; i < LAUNCH_CONFIGS.length; i++) {
            timer = setTimeout(() => spawnArrow(i), i * 320);
          }
        }, 900);
      }
    }
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    app.ticker.remove(tick);
    tex.destroy(true);
    arrows.forEach((a) => a.sprite.destroy());
    cleanupEffects.forEach((fn) => fn());
    [bg, ground, ghostLines, label, labelB].forEach((e) => e.destroy());
  };
}
