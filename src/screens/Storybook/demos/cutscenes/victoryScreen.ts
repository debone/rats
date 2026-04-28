import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';

export function victoryScreen(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x000000);
  overlay.alpha = 0;
  root.addChild(overlay);

  const confetti = new ParticleEmitter({
    texture: Assets.get('tiles').textures.ball,
    maxParticles: 80,
    emitting: false,
    lifespan: { min: 800, max: 1600 },
    speed: { min: 40, max: 160 },
    angle: { min: 0, max: 360 },
    gravityY: 120,
    scale: { start: { min: 0.08, max: 0.28 }, end: 0 },
    tint: { start: 0xffee44, end: 0xff44cc },
    alpha: { start: 1, end: 0 },
    rotate: { min: -400, max: 400 },
  });
  confetti.x = w / 2;
  confetti.y = h / 2 - 20;
  root.addChild(confetti.container);

  // Decorative lines
  const lineTop = new Graphics();
  const lineBot = new Graphics();
  root.addChild(lineTop);
  root.addChild(lineBot);

  const clearText = new Text({
    text: 'LEVEL CLEAR!',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 20, letterSpacing: 5, fontWeight: 'bold', fill: 0xffee44 },
  });
  clearText.anchor.set(0.5);
  clearText.x = w / 2;
  clearText.y = h / 2 - 32;
  clearText.alpha = 0;
  root.addChild(clearText);

  // Cheese icons as "stars"
  const STARS = 3;
  const cheeseTex = Assets.get('prototype').textures['cheese_tile_1#0'];
  const stars: Sprite[] = [];
  const starSpacing = 26;
  const starY = h / 2 + 8;

  for (let i = 0; i < STARS; i++) {
    const s = new Sprite(cheeseTex);
    s.anchor.set(0.5);
    s.scale.set(0);
    s.x = w / 2 + (i - 1) * starSpacing;
    s.y = starY;
    root.addChild(s);
    stars.push(s);
  }

  const scoreText = new Text({
    text: 'SCORE: 0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: 0xddaaff },
  });
  scoreText.anchor.set(0.5);
  scoreText.x = w / 2;
  scoreText.y = h / 2 + 46;
  scoreText.alpha = 0;
  root.addChild(scoreText);

  const play = async () => {
    if (cancelled) return;

    overlay.alpha = 0;
    clearText.alpha = 0;
    clearText.scale.set(0.3);
    stars.forEach((s) => s.scale.set(0));
    scoreText.alpha = 0;
    scoreText.text = 'SCORE: 0';
    lineTop.clear();
    lineBot.clear();

    await animate(overlay, { alpha: 0.7, duration: 400 });
    if (cancelled) return;

    // Lines grow from center outward
    const lp = { w: 0 };
    animate(lp, {
      w: w / 2,
      duration: 500,
      ease: 'outQuad',
      onUpdate: () => {
        lineTop.clear().rect(w / 2 - lp.w, h / 2 - 46, lp.w * 2, 1).fill(0xffee44);
        lineBot.clear().rect(w / 2 - lp.w, h / 2 + 58, lp.w * 2, 1).fill(0x9944bb);
      },
    });

    await animate(clearText, { alpha: 1, scaleX: 1, scaleY: 1, duration: 550, ease: 'outBack(2)' });
    if (cancelled) return;

    confetti.explode(70);

    // Stars pop in staggered
    for (let i = 0; i < STARS; i++) {
      await new Promise<void>((res) => { timer = setTimeout(res, 150); });
      if (cancelled) return;
      animate(stars[i], { scaleX: 0.72, scaleY: 0.72, duration: 350, ease: 'outBack(3)' });
    }

    await animate(scoreText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    // Score ticks up
    const sp = { v: 0 };
    await animate(sp, {
      v: 1240,
      duration: 1000,
      ease: 'outQuad',
      onUpdate: () => { scoreText.text = `SCORE: ${Math.floor(sp.v)}`; },
    });
    if (cancelled) return;

    animate(scoreText, { scaleX: [1.3, 1], scaleY: [1.3, 1], duration: 300, ease: 'outBack' });

    await new Promise<void>((res) => { timer = setTimeout(res, 1600); });
    if (cancelled) return;

    await Promise.all([
      animate(overlay, { alpha: 0, duration: 500 }),
      animate(clearText, { alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 400, ease: 'outQuad' }),
      animate(scoreText, { alpha: 0, duration: 350 }),
      ...stars.map((s) => animate(s, { scaleX: 0, scaleY: 0, duration: 300, ease: 'inBack(2)' })),
    ]);
    if (cancelled) return;

    lineTop.clear();
    lineBot.clear();

    await new Promise<void>((res) => { timer = setTimeout(res, 700); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    confetti.destroy();
    [overlay, lineTop, lineBot, clearText, scoreText, ...stars].forEach((e) => e.destroy());
  };
}
