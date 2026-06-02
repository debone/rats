/**
 * TECHNIQUE: Impact / Hit Reaction — layered flash sequence (via VFX burst)
 *
 * Three simultaneous layers, each with a different decay curve:
 * 1. Screen flash — fills the whole view with white, gone in ~80ms (retina burn)
 * 2. Shockwave ring — stroked circle grows outward, fades over 350ms
 * 3. Spark spray — uses impactSpark (BurstDef) for pooled, reusable sparks
 *
 * Demonstrates the `defineBurst` VFX type: one-shot particle spray with
 * a pooled emitter. The burst is called imperatively via impactSpark.play().
 *
 * Click anywhere to trigger. Auto-fires when idle.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { impactSpark } from '@/core/vfx/effects/impactSpark';
import type { BurstContext } from '@/core/vfx/types';

export function impactFlash(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let autoTimer: ReturnType<typeof setTimeout> | undefined;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080808);
  root.addChild(bg);

  const flashRect = new Graphics();
  root.addChild(flashRect);

  const ringG = new Graphics();
  root.addChild(ringG);

  // Shared spark emitter — pooled and reused across all impacts (mirrors VFXSystem.pool)
  const sparkEmitter = new ParticleEmitter(impactSpark.emitter());
  root.addChild(sparkEmitter.container);

  const burstCtx: BurstContext = {
    emitter: sparkEmitter,
    camera: null as any,
    layer: root,
  };

  const label = new Text({
    text: 'HIT REACTION — flash + ring + sparks  [burst]  (click to trigger)',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x5a3a2a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'impactSpark  ·  defineBurst  ·  pooled emitter, explodes at impact position',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x3a2010, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  const TINTS = [0xffcc44, 0xff6633, 0xaaccff, 0xffaaff, 0x88ffcc];

  interface Impact { x: number; y: number; age: number; color: number; }
  const impacts: Impact[] = [];

  const triggerImpact = (x: number, y: number) => {
    const color = TINTS[Math.floor(Math.random() * TINTS.length)];
    impactSpark.play({ x, y, color, count: 22 }, burstCtx);
    impacts.push({ x, y, age: 0, color });
  };

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
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
        ringG.circle(imp.x, imp.y, 6 + rp * 38).stroke({ color: imp.color, width: 2.5, alpha: ra * 0.65 });
        ringG.circle(imp.x, imp.y, 4 + rp * 22).stroke({ color: 0xffffff, width: 1, alpha: ra * 0.3 });
      }

      if (imp.age > 600) impacts.splice(i, 1);
    }
  };

  bg.eventMode = 'static';
  bg.cursor = 'pointer';
  bg.on('pointerdown', (e) => triggerImpact(e.global.x, e.global.y));

  const scheduleAuto = () => {
    if (cancelled) return;
    triggerImpact(20 + Math.random() * (w - 40), 20 + Math.random() * (h - 40));
    autoTimer = setTimeout(scheduleAuto, 900 + Math.random() * 600);
  };
  autoTimer = setTimeout(scheduleAuto, 400);

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    if (autoTimer) clearTimeout(autoTimer);
    app.ticker.remove(tick);
    sparkEmitter.destroy();
    [bg, flashRect, ringG, label, labelB].forEach((e) => e.destroy());
  };
}
