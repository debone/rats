/**
 * ENVIRONMENT: Industrial Vent Steam
 *
 * Pressure cycle: IDLE → BUILD (grate glows, pressure dial ticks) → BURST →
 * RELEASE (large steam cloud) → SETTLE (wisps) → IDLE
 *
 * Two-layer steam (same pattern as pipeRupture):
 * - Puff layer: large soft circles, slow rise, wide spread
 * - Jet layer:  thin sparks shooting fast upward on burst
 *
 * Ambient: between bursts, 1–2 small wisps per second leak from seams.
 * The pressure indication before the burst is what makes it feel mechanical
 * and satisfying — the player reads "tension → release" without any UI.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeSoftPuffTexture, makeSparkTexture } from '../particleTextures';

type CyclePhase = 'idle' | 'build' | 'burst' | 'settle';

export function ventSteam(root: Container, w: number, h: number): () => void {
  let cancelled = false;

  const ventX = w / 2;
  const ventY = h * 0.62;
  const ventW = 58;

  // ─── Industrial wall background ───────────────────────────────────────
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x0a0c0e);
  // Horizontal rivet-panel lines
  for (let y = 0; y < h; y += 32) {
    bg.rect(0, y, w, 2).fill({ color: 0x060809, alpha: 0.8 });
    // Rivets
    for (let x = 10; x < w; x += 24) {
      bg.circle(x, y + 1, 2).fill(0x141618);
      bg.circle(x, y + 1, 2).stroke({ color: 0x080a0c, width: 0.5 });
    }
  }
  root.addChild(bg);

  // Pipe network behind vent
  const pipes = new Graphics();
  // Main horizontal pipe
  pipes.roundRect(0, ventY - 10, w, 20, 3).fill(0x1e2022);
  pipes.roundRect(0, ventY - 10, w, 20, 3).stroke({ color: 0x0c0e10, width: 1 });
  // Seam rings
  for (let x = 36; x < w; x += 36) {
    pipes.rect(x - 1, ventY - 10, 2, 20).fill({ color: 0x141618, alpha: 0.8 });
  }
  // Vertical supply pipe feeding vent
  pipes.roundRect(ventX - 6, ventY - 50, 12, 50, 2).fill(0x1a1c1e);
  pipes.roundRect(ventX - 6, ventY - 50, 12, 50, 2).stroke({ color: 0x0c0e10, width: 1 });
  root.addChild(pipes);

  // Pressure dial
  const dialG = new Graphics();
  dialG.x = ventX + ventW * 0.7;
  dialG.y = ventY - 8;
  root.addChild(dialG);

  // ─── Grate ────────────────────────────────────────────────────────────
  const grateG = new Graphics();
  root.addChild(grateG);

  const drawGrate = (tint: number, alpha: number) => {
    grateG.clear();
    grateG.roundRect(ventX - ventW / 2, ventY - 8, ventW, 16, 2).fill({ color: tint, alpha });
    grateG.roundRect(ventX - ventW / 2, ventY - 8, ventW, 16, 2).stroke({ color: 0x0c0e10, width: 1 });
    // Horizontal slats
    for (let sy = ventY - 5; sy < ventY + 6; sy += 4) {
      grateG.rect(ventX - ventW / 2 + 2, sy, ventW - 4, 2).fill({ color: 0x0c0e10, alpha: 0.9 });
    }
  };
  drawGrate(0x222426, 1);

  // ─── Particle emitters ────────────────────────────────────────────────
  const puffTex  = makeSoftPuffTexture();
  const sparkTex = makeSparkTexture();

  const puffEmitter = new ParticleEmitter({
    texture: puffTex,
    maxParticles: 60,
    emitting: true,
    frequency: 1800,    // ambient leak: 1 every 1.8s
    quantity: 1,
    lifespan: { min: 800, max: 1600 },
    speed: { min: 12, max: 35 },
    angle: { min: 255, max: 285 },
    scale: { start: { min: 0.2, max: 0.4 }, end: 0.9 },
    tint: { start: 0xaabbaa, end: 0x606860 },
    alpha: { start: 0.3, end: 0 },
  });
  puffEmitter.x = ventX;
  puffEmitter.y = ventY - 10;
  root.addChild(puffEmitter.container);

  const jetEmitter = new ParticleEmitter({
    texture: sparkTex,
    maxParticles: 40,
    emitting: false,
    lifespan: { min: 150, max: 350 },
    speed: { min: 80, max: 220 },
    angle: { min: 255, max: 285 },
    scale: { start: { min: 0.1, max: 0.28 }, end: 0 },
    tint: { start: 0xddeedd, end: 0x8899aa },
    alpha: { start: 0.85, end: 0 },
  });
  jetEmitter.x = ventX;
  jetEmitter.y = ventY - 10;
  root.addChild(jetEmitter.container);

  // ─── Pressure cycle state machine ────────────────────────────────────
  let phase: CyclePhase = 'idle';
  let phaseTimer = 0;
  let pressure = 0;      // 0..1

  const IDLE_DURATION    = 2800;
  const BUILD_DURATION   = 2000;
  const BURST_DURATION   = 600;
  const SETTLE_DURATION  = 1200;

  const drawDial = (p: number) => {
    dialG.clear();
    dialG.circle(0, 0, 8).fill(0x181a1c);
    dialG.circle(0, 0, 8).stroke({ color: 0x2a2c2e, width: 1 });
    // Needle (0 = left, 1 = red zone right)
    const angle = -Math.PI * 0.75 + p * Math.PI * 1.5;
    const needleColor = p > 0.7 ? 0xff3322 : p > 0.4 ? 0xffaa22 : 0x44cc66;
    dialG
      .moveTo(0, 0)
      .lineTo(Math.cos(angle) * 6, Math.sin(angle) * 6)
      .stroke({ color: needleColor, width: 1.5 });
    dialG.circle(0, 0, 1.5).fill(0x333538);
  };

  const label = new Text({
    text: 'ENV: VENT STEAM — pressure cycle: idle → build → burst → settle',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a3038, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const tick = (dt: { deltaMS: number }) => {
    if (cancelled) return;
    phaseTimer += dt.deltaMS;

    if (phase === 'idle') {
      pressure = Math.max(0, pressure - dt.deltaMS * 0.001 * 0.3);
      if (phaseTimer >= IDLE_DURATION) { phase = 'build'; phaseTimer = 0; }
      drawGrate(0x222426, 1);
    }
    else if (phase === 'build') {
      pressure = Math.min(1, phaseTimer / BUILD_DURATION);
      const heat = pressure * 0.3;
      const heatColor = Math.round(heat * 0xff) * 0x10000 + 0x2222;
      drawGrate(0x222426 + heatColor, 1);
      if (phaseTimer >= BUILD_DURATION) {
        phase = 'burst'; phaseTimer = 0;
        puffEmitter.explode(18);
        jetEmitter.explode(22);
      }
    }
    else if (phase === 'burst') {
      if (phaseTimer < BURST_DURATION * 0.5) {
        puffEmitter.explode(4);
        jetEmitter.explode(3);
      }
      pressure = Math.max(0, 1 - phaseTimer / BURST_DURATION);
      drawGrate(0x223032, 1);
      if (phaseTimer >= BURST_DURATION) { phase = 'settle'; phaseTimer = 0; }
    }
    else if (phase === 'settle') {
      pressure = Math.max(0, pressure - dt.deltaMS * 0.001 * 0.8);
      if (phaseTimer % 400 < dt.deltaMS) puffEmitter.explode(2);
      drawGrate(0x222426, 1);
      if (phaseTimer >= SETTLE_DURATION) { phase = 'idle'; phaseTimer = 0; }
    }

    drawDial(pressure);
  };

  app.ticker.add(tick);

  return () => {
    cancelled = true;
    app.ticker.remove(tick);
    puffTex.destroy(true);
    sparkTex.destroy(true);
    [puffEmitter, jetEmitter].forEach((e) => e.destroy());
    [bg, pipes, dialG, grateG, label].forEach((e) => e.destroy());
  };
}
