/**
 * TECHNIQUE: Procedural Lightning — recursive midpoint displacement (via VFX sequence)
 *
 * Demonstrates the `defineSequence` VFX type with procedural geometry.
 * lightningStrike is a self-contained sequence: it generates the bolt,
 * draws it using ctx.layer, flashes ctx.stage, and cleans up on completion.
 *
 * Subdivide a line segment: find midpoint, displace perpendicular by
 * a random amount proportional to length × roughness. Recurse 5 times.
 * Branching: sprout 2–3 side bolts from random intermediate points.
 *
 * The screen-wide flash fires via ctx.stage — a full-viewport overlay.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { lightningStrike } from '@/core/vfx/effects/lightningStrike';
import { createTimeline } from 'animejs';
import type { SequenceContext } from '@/core/vfx/types';

const COLORS = [0xaaccff, 0xcc99ff, 0xffffff, 0x88ffff];

export function lightningBolt(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x06060e);
  root.addChild(bg);

  const city = new Graphics();
  for (let x = 0; x < w; x += 12 + Math.floor(Math.random() * 16)) {
    const bh = 14 + Math.random() * 30;
    city.rect(x, h - bh, 10 + Math.random() * 8, bh).fill({ color: 0x0a0a18, alpha: 0.9 });
  }
  root.addChild(city);

  const label = new Text({
    text: 'PROCEDURAL LIGHTNING — recursive midpoint displacement  [sequence]',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x2a2a6a, letterSpacing: 1 },
  });
  label.x = 6;
  label.y = 6;
  root.addChild(label);

  const labelB = new Text({
    text: 'lightningStrike  ·  defineSequence  ·  bolt on ctx.layer, screen flash on ctx.stage',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: 0x1a1a4a, letterSpacing: 1 },
  });
  labelB.x = 6;
  labelB.y = h - 12;
  root.addChild(labelB);

  // Minimal SequenceContext — stage = root so the flash covers the whole demo area
  const ctx: SequenceContext = {
    camera: null as any,
    layer: root,
    stage: root,
    size: { width: w, height: h },
    cutscene: () => Promise.resolve(),
    timeline: () => createTimeline(),
  };

  const scheduleStrike = () => {
    if (cancelled) return;
    const startX = w * 0.2 + Math.random() * w * 0.6;
    const endX = startX + (Math.random() - 0.5) * w * 0.4;
    const endY = h - 20 - Math.random() * h * 0.3;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    lightningStrike.build({ x1: startX, y1: 0, x2: endX, y2: endY, color }, ctx);

    const gap = 800 + Math.random() * 1200;
    timer = setTimeout(scheduleStrike, gap);
  };

  timer = setTimeout(scheduleStrike, 300);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    [bg, city, label, labelB].forEach((e) => e.destroy());
  };
}
