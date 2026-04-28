import { animate } from 'animejs';
import { Assets, Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';

export function countdown(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cx = w / 2;
  const cy = h / 2;

  // Ring that expands and fades on each beat
  const ring = new Graphics();
  root.addChild(ring);

  const numText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 64, fontWeight: 'bold' },
  });
  numText.anchor.set(0.5);
  numText.x = cx;
  numText.y = cy;
  numText.alpha = 0;
  root.addChild(numText);

  const goText = new Text({
    text: 'GO!',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 48, fontWeight: 'bold', fill: 0x44ff88, letterSpacing: 4 },
  });
  goText.anchor.set(0.5);
  goText.x = cx;
  goText.y = cy;
  goText.alpha = 0;
  root.addChild(goText);

  const burst = new ParticleEmitter({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 70,
    emitting: false,
    lifespan: { min: 400, max: 900 },
    speed: { min: 60, max: 220 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.1, max: 0.4 }, end: 0 },
    tint: { start: 0x44ff88, end: 0xffee44 },
    alpha: { start: 1, end: 0 },
    rotate: { min: -300, max: 300 },
  });
  burst.x = cx;
  burst.y = cy;
  root.addChild(burst.container);

  const COLORS = [0xff4444, 0xffaa22, 0xffee22];

  const ringProxy = { r: 0, alpha: 0 };
  const drawRing = () => {
    ring.clear().circle(cx, cy, ringProxy.r)
      .stroke({ color: 0xffffff, width: 2, alpha: ringProxy.alpha });
  };

  const beatRing = () => {
    ringProxy.r = 24;
    ringProxy.alpha = 0.9;
    animate(ringProxy, { r: 80, alpha: 0, duration: 550, ease: 'outQuad', onUpdate: drawRing });
  };

  const play = async () => {
    if (cancelled) return;

    numText.alpha = 0;
    numText.scale.set(1);
    numText.rotation = 0;
    numText.y = cy;
    goText.alpha = 0;
    goText.scale.set(0);
    ring.clear();

    for (let n = 3; n >= 1; n--) {
      if (cancelled) return;

      numText.text = String(n);
      numText.style.fill = COLORS[3 - n];
      numText.alpha = 1;
      numText.scale.set(1);
      numText.rotation = 0;

      // Each number enters differently
      if (n === 3) {
        // Slam down from above
        numText.y = cy - 70;
        await animate(numText, { y: cy, duration: 380, ease: 'outBounce' });
      } else if (n === 2) {
        // Spin in from nothing
        numText.y = cy;
        numText.scale.set(0);
        numText.rotation = -Math.PI * 1.5;
        await animate(numText, { scaleX: 1, scaleY: 1, rotation: 0, duration: 420, ease: 'outBack(2)' });
      } else {
        // Scale slam: starts huge, snap to size
        numText.y = cy;
        numText.scale.set(3);
        numText.rotation = 0;
        await animate(numText, { scaleX: 1, scaleY: 1, duration: 300, ease: 'outElastic(1, 0.5)' });
      }
      if (cancelled) return;

      beatRing();

      await new Promise<void>((res) => { timer = setTimeout(res, 260); });
      if (cancelled) return;

      // Exit: shrink + fade
      await animate(numText, { scaleX: 0.4, scaleY: 0.4, alpha: 0, duration: 200, ease: 'inBack(2)' });
      if (cancelled) return;

      numText.alpha = 0;
      numText.scale.set(1);
    }

    // GO!
    goText.alpha = 1;
    goText.scale.set(0.1);
    goText.rotation = -0.15;

    burst.explode(60);
    beatRing();

    await animate(goText, { scaleX: 1.15, scaleY: 1.15, rotation: 0, duration: 420, ease: 'outBack(3)' });
    if (cancelled) return;

    // Expand and vanish
    await animate(goText, { scaleX: 3, scaleY: 3, alpha: 0, duration: 500, ease: 'outQuad' });
    if (cancelled) return;

    ring.clear();
    goText.scale.set(0);

    await new Promise<void>((res) => { timer = setTimeout(res, 500); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    burst.destroy();
    [ring, numText, goText].forEach((e) => e.destroy());
  };
}
