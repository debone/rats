import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ASSETS } from '@/assets';

export function secretFound(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let spinAnim: ReturnType<typeof animate> | null = null;

  const cx = w / 2;

  // Gold shimmer sweep emitter
  const shimmer = new ParticleEmitter({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 60,
    emitting: false,
    lifespan: { min: 300, max: 700 },
    speed: { min: 8, max: 50 },
    angle: { min: -60, max: 60 },
    scale: { start: { min: 0.05, max: 0.18 }, end: 0 },
    tint: { start: 0xffee44, end: 0xffaa00 },
    alpha: { start: 0.9, end: 0 },
  });
  shimmer.y = h / 2;
  root.addChild(shimmer.container);

  // Banner strip
  const banner = new Graphics();
  banner.rect(0, h / 2 - 24, w, 48).fill(0x0d0d1e);
  banner.alpha = 0;
  root.addChild(banner);

  // Border lines of banner
  const bannerTop = new Graphics();
  const bannerBot = new Graphics();
  root.addChild(bannerTop);
  root.addChild(bannerBot);

  const secretText = new Text({
    text: '✦  SECRET FOUND  ✦',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 13, letterSpacing: 5, fill: 0xffee44, fontWeight: 'bold' },
  });
  secretText.anchor.set(0.5);
  secretText.x = cx;
  secretText.y = h / 2;
  secretText.alpha = 0;
  root.addChild(secretText);

  // Cheese icon above banner
  const icon = new Sprite(Assets.get(ASSETS.prototype).textures['cheese_tile_1#0']);
  icon.anchor.set(0.5);
  icon.x = cx;
  icon.y = h / 2 - 56;
  icon.scale.set(0);
  icon.alpha = 0;
  root.addChild(icon);

  // Sparkle burst
  const sparkles = new ParticleEmitter({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 70,
    emitting: false,
    lifespan: { min: 500, max: 1000 },
    speed: { min: 20, max: 120 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.07, max: 0.24 }, end: 0 },
    tint: { start: 0xffee44, end: 0xff8800 },
    alpha: { start: 1, end: 0 },
    rotate: { min: -200, max: 200 },
  });
  sparkles.x = cx;
  sparkles.y = h / 2 - 56;
  root.addChild(sparkles.container);

  const ptsText = new Text({
    text: '+500 PTS',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, fill: 0xffee44, fontWeight: 'bold' },
  });
  ptsText.anchor.set(0.5);
  ptsText.x = cx;
  ptsText.y = h / 2 + 42;
  ptsText.alpha = 0;
  root.addChild(ptsText);

  const play = async () => {
    if (cancelled) return;

    banner.alpha = 0;
    bannerTop.clear();
    bannerBot.clear();
    secretText.alpha = 0;
    icon.scale.set(0);
    icon.alpha = 1;
    icon.rotation = 0;
    ptsText.alpha = 0;
    ptsText.scale.set(1);
    spinAnim?.cancel();

    // Gold shimmer sweeps left → right
    const sweepProxy = { x: -20 };
    await animate(sweepProxy, {
      x: w + 20,
      duration: 650,
      ease: 'linear',
      onUpdate: () => {
        shimmer.x = sweepProxy.x;
        shimmer.explode(4);
      },
    });
    if (cancelled) return;

    // Banner drops in (scaleY from 0)
    await animate(banner, { alpha: 1, scaleY: [0, 1], duration: 320, ease: 'outBack(2)' });
    if (cancelled) return;

    // Border lines grow from center
    const lp = { w: 0 };
    animate(lp, {
      w: w / 2,
      duration: 350,
      ease: 'outQuad',
      onUpdate: () => {
        bannerTop
          .clear()
          .rect(cx - lp.w, h / 2 - 24, lp.w * 2, 1)
          .fill({ color: 0xffee44, alpha: 0.5 });
        bannerBot
          .clear()
          .rect(cx - lp.w, h / 2 + 24, lp.w * 2, 1)
          .fill({ color: 0x9944bb, alpha: 0.5 });
      },
    });

    await animate(secretText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    // Icon bounces in
    await animate(icon, { scaleX: [0, 0.9], scaleY: [0, 0.9], duration: 500, ease: 'outBounce' });
    if (cancelled) return;

    sparkles.explode(55);

    // Points pop up
    await animate(ptsText, { alpha: 1, scaleX: [0.3, 1.1], scaleY: [0.3, 1.1], duration: 400, ease: 'outBack(2)' });
    if (cancelled) return;

    animate(ptsText, { scaleX: 1, scaleY: 1, duration: 200 });

    // Idle: icon slowly spins
    const doSpin = () => {
      spinAnim = animate(icon, { rotation: Math.PI * 2, duration: 2500, ease: 'linear' });
      spinAnim.then(() => {
        if (!cancelled) doSpin();
      });
    };
    doSpin();

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2200);
    });
    if (cancelled) return;

    spinAnim?.cancel();

    await Promise.all([
      animate(banner, { alpha: 0, duration: 350 }),
      animate(secretText, { alpha: 0, duration: 300 }),
      animate(icon, { alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 380, ease: 'outQuad' }),
      animate(ptsText, { alpha: 0, duration: 300 }),
    ]);
    if (cancelled) return;

    bannerTop.clear();
    bannerBot.clear();

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    spinAnim?.cancel();
    shimmer.destroy();
    sparkles.destroy();
    [banner, bannerTop, bannerBot, secretText, icon, ptsText].forEach((e) => e.destroy());
  };
}
