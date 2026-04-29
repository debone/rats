import { animate } from 'animejs';
import { Assets, Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';

export function sewageSurge(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let bubbleInterval: ReturnType<typeof setInterval> | undefined;

  const cx = w / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x040604);
  bg.alpha = 0;
  root.addChild(bg);

  // Tunnel walls — two vertical columns
  const walls = new Graphics();
  walls
    .rect(0, 0, 14, h)
    .fill(0x2a2218)
    .stroke({ color: 0x1a1208, width: 1 });
  walls
    .rect(w - 14, 0, 14, h)
    .fill(0x2a2218)
    .stroke({ color: 0x1a1208, width: 1 });
  // Brick lines on walls
  for (let y = 8; y < h; y += 14) {
    walls
      .moveTo(0, y)
      .lineTo(14, y)
      .stroke({ color: 0x1a1208, width: 1 });
    walls
      .moveTo(w - 14, y)
      .lineTo(w, y)
      .stroke({ color: 0x1a1208, width: 1 });
  }
  walls.alpha = 0;
  root.addChild(walls);

  // Sewage liquid body (filled rect, grows upward)
  const sewage = new Graphics();
  root.addChild(sewage);

  // Foam / surface ripple line on top of sewage
  const surface = new Graphics();
  root.addChild(surface);

  // Bubbles rising through the sewage
  const bubbles = new ParticleEmitter({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 40,
    emitting: false,
    lifespan: { min: 600, max: 1400 },
    speed: { min: 10, max: 35 },
    angle: { min: 265, max: 275 },
    scale: { start: { min: 0.04, max: 0.12 }, end: 0 },
    tint: { start: 0x3a5a30, end: 0x1a3018 },
    alpha: { start: 0.6, end: 0 },
  });
  bubbles.x = cx;
  root.addChild(bubbles.container);

  // Surface splatter particles
  const splatter = new ParticleEmitter({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 30,
    emitting: false,
    lifespan: { min: 200, max: 500 },
    speed: { min: 20, max: 60 },
    angle: { min: 200, max: 340 },
    scale: { start: { min: 0.06, max: 0.14 }, end: 0 },
    tint: { start: 0x4a6a38, end: 0x2a3820 },
    alpha: { start: 0.8, end: 0 },
    gravityY: 80,
  });
  splatter.x = cx;
  root.addChild(splatter.container);

  const warningText = new Text({
    text: 'SEWAGE SURGE',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 4, fill: 0x4a7a3a, fontWeight: 'bold' },
  });
  warningText.anchor.set(0.5);
  warningText.x = cx;
  warningText.y = 16;
  warningText.alpha = 0;
  root.addChild(warningText);

  const levelText = new Text({
    text: '▲  RISING',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x3a5a2a },
  });
  levelText.anchor.set(0.5);
  levelText.x = cx;
  levelText.y = 28;
  levelText.alpha = 0;
  root.addChild(levelText);

  const drawSewage = (liquidY: number, foamAlpha: number) => {
    const liquidH = h - liquidY;

    sewage
      .clear()
      .rect(14, liquidY, w - 28, liquidH)
      .fill({ color: 0x1a3818, alpha: 0.9 });

    // Lighter sheen at the very top
    sewage
      .rect(14, liquidY, w - 28, 3)
      .fill({ color: 0x3a6830, alpha: 0.5 });

    // Surface foam blobs
    surface.clear();
    if (foamAlpha > 0) {
      for (let fx = 20; fx < w - 20; fx += 18) {
        surface
          .ellipse(fx + Math.sin(fx * 0.3) * 4, liquidY, 6 + Math.cos(fx * 0.2) * 2, 2)
          .fill({ color: 0x5a8848, alpha: foamAlpha * 0.4 });
      }
    }
  };

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    walls.alpha = 0;
    sewage.clear();
    surface.clear();
    warningText.alpha = 0;
    levelText.alpha = 0;
    clearInterval(bubbleInterval);

    await animate(bg, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await animate(walls, { alpha: 1, duration: 350 });
    if (cancelled) return;

    await animate(warningText, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await animate(levelText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    // Sewage rises from below — starts at bottom, surges upward
    const sp = { liquidY: h, foam: 0 };

    bubbleInterval = setInterval(() => {
      if (cancelled) {
        clearInterval(bubbleInterval);
        return;
      }
      bubbles.x = 14 + Math.random() * (w - 28);
      bubbles.y = sp.liquidY + 10 + Math.random() * (h - sp.liquidY - 10);
      bubbles.explode(1);

      // Surface splatter occasionally
      if (Math.random() < 0.25) {
        splatter.x = 14 + Math.random() * (w - 28);
        splatter.y = sp.liquidY;
        splatter.explode(2);
      }
    }, 120);

    await animate(sp, {
      liquidY: h * 0.28,
      foam: 1,
      duration: 2600,
      ease: 'inOutQuad',
      onUpdate: () => {
        drawSewage(sp.liquidY, sp.foam);
      },
    });
    if (cancelled) return;

    // Surge holds at peak
    await new Promise<void>((res) => {
      timer = setTimeout(res, 800);
    });
    if (cancelled) return;

    clearInterval(bubbleInterval);

    // Drain back down
    await animate(sp, {
      liquidY: h,
      foam: 0,
      duration: 1800,
      ease: 'inQuad',
      onUpdate: () => {
        drawSewage(sp.liquidY, sp.foam);
      },
    });
    if (cancelled) return;

    sewage.clear();
    surface.clear();

    await Promise.all([
      animate(bg, { alpha: 0, duration: 500 }),
      animate(walls, { alpha: 0, duration: 400 }),
      animate(warningText, { alpha: 0, duration: 350 }),
      animate(levelText, { alpha: 0, duration: 350 }),
    ]);
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    clearInterval(bubbleInterval);
    bubbles.destroy();
    splatter.destroy();
    [bg, walls, sewage, surface, warningText, levelText].forEach((e) => e.destroy());
  };
}
