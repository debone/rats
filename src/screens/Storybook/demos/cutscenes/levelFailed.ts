import { animate } from 'animejs';
import { Assets, Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ASSETS } from '@/assets';

export function levelFailed(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Dark, desaturated overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x050308);
  overlay.alpha = 0;
  root.addChild(overlay);

  // Rain emitter — fine vertical streaks from top
  const rain = new ParticleEmitter({
    texture: Assets.get(ASSETS.tiles).textures.ball,
    maxParticles: 80,
    emitting: false,
    lifespan: { min: 400, max: 700 },
    speed: { min: 80, max: 160 },
    angle: { min: 85, max: 95 },
    scale: { start: { min: 0.03, max: 0.08 }, end: 0 },
    tint: { start: 0x334466, end: 0x112233 },
    alpha: { start: 0.6, end: 0 },
  });
  rain.x = w / 2;
  rain.y = 0;
  root.addChild(rain.container);

  // Horizontal rule lines
  const ruleTop = new Graphics();
  const ruleBot = new Graphics();
  root.addChild(ruleTop);
  root.addChild(ruleBot);

  const failText = new Text({
    text: 'MISSION FAILED',
    style: {
      ...TEXT_STYLE_DEFAULT,
      fontSize: 18,
      letterSpacing: 5,
      fontWeight: 'bold',
      fill: 0x664455,
    },
  });
  failText.anchor.set(0.5);
  failText.x = w / 2;
  failText.y = h / 2 - 18;
  failText.alpha = 0;
  root.addChild(failText);

  const reasonText = new Text({
    text: 'All lives lost.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0x443344, letterSpacing: 2 },
  });
  reasonText.anchor.set(0.5);
  reasonText.x = w / 2;
  reasonText.y = h / 2 + 8;
  reasonText.alpha = 0;
  root.addChild(reasonText);

  const needText = new Text({
    text: 'You needed  3  more cheese.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x334455 },
  });
  needText.anchor.set(0.5);
  needText.x = w / 2;
  needText.y = h / 2 + 26;
  needText.alpha = 0;
  root.addChild(needText);

  const retryText = new Text({
    text: '— continue? —',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 3, fill: 0x442255 },
  });
  retryText.anchor.set(0.5);
  retryText.x = w / 2;
  retryText.y = h / 2 + 50;
  retryText.alpha = 0;
  root.addChild(retryText);

  let retryPulse: ReturnType<typeof animate> | null = null;
  let rainInterval: ReturnType<typeof setInterval> | undefined;

  const play = async () => {
    if (cancelled) return;

    overlay.alpha = 0;
    ruleTop.clear();
    ruleBot.clear();
    failText.alpha = 0;
    failText.y = h / 2 - 10;
    reasonText.alpha = 0;
    needText.alpha = 0;
    retryText.alpha = 0;
    retryPulse?.cancel();

    // Slow dark fade
    await animate(overlay, { alpha: 0.96, duration: 800, ease: 'outQuad' });
    if (cancelled) return;

    // Start rain
    clearInterval(rainInterval);
    rainInterval = setInterval(() => {
      if (cancelled) {
        clearInterval(rainInterval);
        return;
      }
      rain.x = Math.random() * w;
      rain.explode(3);
    }, 60);

    await new Promise<void>((res) => {
      timer = setTimeout(res, 400);
    });
    if (cancelled) return;

    // Thin rules grow slowly
    const lp = { w: 0 };
    animate(lp, {
      w: w / 2,
      duration: 700,
      ease: 'outQuad',
      onUpdate: () => {
        ruleTop
          .clear()
          .rect(w / 2 - lp.w, h / 2 - 32, lp.w * 2, 1)
          .fill({ color: 0x332244, alpha: 0.8 });
        ruleBot
          .clear()
          .rect(w / 2 - lp.w, h / 2 + 36, lp.w * 2, 1)
          .fill({ color: 0x332244, alpha: 0.8 });
      },
    });

    // "MISSION FAILED" drifts down slowly
    await animate(failText, { alpha: 1, y: h / 2 - 18, duration: 900, ease: 'outQuad' });
    if (cancelled) return;

    await animate(reasonText, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await animate(needText, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (cancelled) return;

    await animate(retryText, { alpha: 1, duration: 400 });
    if (cancelled) return;

    retryPulse = animate(retryText, { alpha: [1, 0.2, 1], duration: 1200, loop: true });

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2400);
    });
    if (cancelled) return;

    retryPulse.cancel();
    clearInterval(rainInterval);

    await Promise.all([
      animate(overlay, { alpha: 0, duration: 600 }),
      animate(failText, { alpha: 0, duration: 400 }),
      animate(reasonText, { alpha: 0, duration: 400 }),
      animate(needText, { alpha: 0, duration: 400 }),
      animate(retryText, { alpha: 0, duration: 400 }),
    ]);
    ruleTop.clear();
    ruleBot.clear();
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 700);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    clearInterval(rainInterval);
    retryPulse?.cancel();
    rain.destroy();
    [overlay, ruleTop, ruleBot, failText, reasonText, needText, retryText].forEach((e) => e.destroy());
  };
}
