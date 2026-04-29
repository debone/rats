/**
 * TECHNIQUE: Impact / Hit Reaction — layered flash sequence
 *
 * Three simultaneous layers, each with a different decay curve:
 * 1. Screen flash — fills the whole view with white, gone in ~80ms (retina burn)
 * 2. Shockwave ring — stroked circle grows outward, fades over 350ms
 * 3. Spark spray — N sprites shoot radially, gravity drags them down
 *
 * The layering is what sells it: any single layer looks cheap alone.
 * Combine all three and the viewer reads "explosion" immediately.
 *
 * Click anywhere to trigger. Auto-fires when idle.
 */
import { Container, Graphics, RenderTexture, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const GRAVITY = 280;
const SPARK_COUNT = 22;

interface Spark {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

function makeSparkDot(): RenderTexture {
  const g = new Graphics();
  g.circle(0, 0, 3).fill(0xffffff);
  g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.2 });
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export function impactFlash(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let autoTimer: ReturnType<typeof setTimeout> | undefined;
  const sparkTex = makeSparkDot();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080808);
  root.addChild(bg);

  // Screen flash layer — lives behind everything
  const flashRect = new Graphics();
  root.addChild(flashRect);

  // Ring layer
  const ringG = new Graphics();
  root.addChild(ringG);

  // Spark container
  const sparkCont = new Container();
  root.addChild(sparkCont);

  const label = new Text({
    text: 'HIT REACTION — flash + ring + sparks (click to trigger)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x5a3a2a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'layer 1: screen flash  |  layer 2: shockwave ring  |  layer 3: spark spray',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x3a2010, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  // Active impact state
  interface Impact {
    x: number;
    y: number;
    age: number;
    sparks: Spark[];
    color: number;
  }
  const impacts: Impact[] = [];

  const TINTS = [0xffcc44, 0xff6633, 0xaaccff, 0xffaaff, 0x88ffcc];

  const triggerImpact = (x: number, y: number) => {
    const color = TINTS[Math.floor(Math.random() * TINTS.length)];
    const sparks: Spark[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 60 + Math.random() * 180;
      const sprite = new Sprite(sparkTex);
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      sprite.tint = color;
      sprite.scale.set(0.4 + Math.random() * 0.6);
      sparkCont.addChild(sprite);
      sparks.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 350 + Math.random() * 200,
      });
    }
    impacts.push({ x, y, age: 0, sparks, color });
  };

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    const delta = dt.deltaMS / 1000;

    flashRect.clear();
    ringG.clear();

    for (let i = impacts.length - 1; i >= 0; i--) {
      const imp = impacts[i];
      imp.age += dt.deltaMS;

      // Layer 1: screen-wide flash (80ms)
      const fa = Math.max(0, 1 - imp.age / 80);
      if (fa > 0) {
        flashRect.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: fa * 0.55 });
        flashRect.circle(imp.x, imp.y, 20).fill({ color: 0xffffff, alpha: fa });
      }

      // Layer 2: ring (350ms)
      const rp = Math.min(1, imp.age / 350);
      const ra = Math.max(0, 1 - Math.max(0, imp.age - 120) / 230);
      if (ra > 0) {
        const r1 = 6 + rp * 38;
        const r2 = 4 + rp * 22;
        ringG.circle(imp.x, imp.y, r1).stroke({ color: imp.color, width: 2.5, alpha: ra * 0.65 });
        ringG.circle(imp.x, imp.y, r2).stroke({ color: 0xffffff, width: 1, alpha: ra * 0.3 });
      }

      // Layer 3: sparks
      imp.sparks.forEach((s) => {
        s.age += dt.deltaMS;
        s.vy += GRAVITY * delta;
        s.sprite.x += s.vx * delta;
        s.sprite.y += s.vy * delta;
        const a = Math.max(0, 1 - s.age / s.life);
        s.sprite.alpha = a;
        s.sprite.scale.set((0.4 + (1 - s.age / s.life) * 0.6) * (1 - s.age / s.life * 0.3));
      });

      if (imp.age > 600) {
        imp.sparks.forEach((s) => s.sprite.destroy());
        impacts.splice(i, 1);
      }
    }
  };

  // Click to trigger
  bg.eventMode = 'static';
  bg.cursor = 'pointer';
  bg.on('pointerdown', (e) => {
    const local = e.global;
    triggerImpact(local.x, local.y);
  });

  // Auto-fire
  const scheduleAuto = () => {
    if (cancelled) return;
    const x = 20 + Math.random() * (w - 40);
    const y = 20 + Math.random() * (h - 40);
    triggerImpact(x, y);
    autoTimer = setTimeout(scheduleAuto, 900 + Math.random() * 600);
  };
  autoTimer = setTimeout(scheduleAuto, 400);

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    if (autoTimer) clearTimeout(autoTimer);
    app.ticker.remove(tick);
    sparkTex.destroy(true);
    impacts.forEach((imp) => imp.sparks.forEach((s) => s.sprite.destroy()));
    [bg, flashRect, ringG, sparkCont, label, labelB].forEach((e) => e.destroy());
  };
}
