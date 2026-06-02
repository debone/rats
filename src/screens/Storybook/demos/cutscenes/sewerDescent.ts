import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeDropletTexture, makeSoftPuffTexture } from '../particleTextures';

export function sewerDescent(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fogInterval: ReturnType<typeof setInterval> | undefined;
  let dripInterval: ReturnType<typeof setInterval> | undefined;

  const cx = w / 2;
  const cy = h / 2;

  // Bake particle textures once — destroyed in cleanup
  const puffTex = makeSoftPuffTexture();
  const dropletTex = makeDropletTexture();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x040806);
  bg.alpha = 0;
  root.addChild(bg);

  // Grate — horizontal bars that slide apart alternately
  const NUM_BARS = 5;
  const GRATE_W = w - 20;
  const GRATE_H = 7;
  const GRATE_GAP = 10;
  const grateX = 10;
  const grateY0 = cy - (NUM_BARS * (GRATE_H + GRATE_GAP)) / 2;

  const grateGroup = new Container();
  grateGroup.alpha = 0;
  root.addChild(grateGroup);

  const bars: Graphics[] = [];
  for (let i = 0; i < NUM_BARS; i++) {
    const bar = new Graphics();
    bar
      .roundRect(grateX, grateY0 + i * (GRATE_H + GRATE_GAP), GRATE_W, GRATE_H, 2)
      .fill(0x5a5040)
      .stroke({ color: 0x2a2010, width: 1 });
    grateGroup.addChild(bar);
    bars.push(bar);
  }

  // Green sewage glow from below
  const glow = new Graphics();
  root.addChild(glow);

  /**
   * Soft-puff fog: feathered circles drift upward — looks like actual billowing gas
   * rather than solid balls. The concentric alpha rings create the diffuse edge.
   */
  const fog = new ParticleEmitter({
    texture: puffTex,
    maxParticles: 50,
    emitting: false,
    lifespan: { min: 1400, max: 2800 },
    speed: { min: 4, max: 18 },
    angle: { min: 258, max: 282 },
    scale: { start: { min: 0.5, max: 1.4 }, end: 1.9 },
    tint: { start: 0x1a3a20, end: 0x040806 },
    alpha: { start: 0.45, end: 0 },
  });
  fog.x = cx;
  fog.y = cy + 30;
  root.addChild(fog.container);

  /**
   * Droplet drips: teardrop shape (round head, tapered tip) falling vertically.
   * Looks far more convincing as water than the ball sprite.
   */
  const drips = new ParticleEmitter({
    texture: dropletTex,
    maxParticles: 30,
    emitting: false,
    lifespan: { min: 500, max: 1100 },
    speed: { min: 50, max: 90 },
    angle: { min: 86, max: 94 },
    scale: { start: { min: 0.2, max: 0.45 }, end: 0.05 },
    tint: { start: 0x304848, end: 0x102020 },
    alpha: { start: 0.85, end: 0 },
  });
  drips.y = 0;
  root.addChild(drips.container);

  const titleText = new Text({
    text: '— DESCENDING —',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 4, fill: 0x4a7a5a },
  });
  titleText.anchor.set(0.5);
  titleText.x = cx;
  titleText.y = cy + 46;
  titleText.alpha = 0;
  root.addChild(titleText);

  const subText = new Text({
    text: 'sublevel B3  ·  main drain',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x284030, letterSpacing: 2 },
  });
  subText.anchor.set(0.5);
  subText.x = cx;
  subText.y = cy + 60;
  subText.alpha = 0;
  root.addChild(subText);

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    grateGroup.alpha = 0;
    bars.forEach((b) => {
      b.x = 0;
      b.alpha = 1;
    });
    glow.clear();
    titleText.alpha = 0;
    subText.alpha = 0;
    clearInterval(fogInterval);
    clearInterval(dripInterval);

    await animate(bg, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await animate(grateGroup, { alpha: 1, duration: 350 });
    if (cancelled) return;

    // Bars alternate: odd slide left, even slide right
    await Promise.all(
      bars.map((bar, i) =>
        animate(bar, {
          x: i % 2 === 0 ? -(GRATE_W + 30) : GRATE_W + 30,
          alpha: 0,
          duration: 550,
          ease: 'inBack(1.5)',
          delay: i * 55,
        }),
      ),
    );
    if (cancelled) return;

    // Sewage glow pulses up from center
    const gp = { r: 0, alpha: 0 };
    animate(gp, {
      r: 55,
      alpha: 0.14,
      duration: 900,
      ease: 'outQuad',
      onUpdate: () => {
        glow
          .clear()
          .ellipse(cx, cy + 10, gp.r, gp.r * 0.4)
          .fill({ color: 0x1a5a2a, alpha: gp.alpha });
      },
    });

    fogInterval = setInterval(() => {
      if (cancelled) {
        clearInterval(fogInterval);
        return;
      }
      fog.x = cx + (Math.random() - 0.5) * 90;
      fog.explode(2);
    }, 140);

    dripInterval = setInterval(() => {
      if (cancelled) {
        clearInterval(dripInterval);
        return;
      }
      drips.x = 10 + Math.random() * (w - 20);
      drips.explode(1);
    }, 200);

    await animate(titleText, { alpha: 1, duration: 700 });
    if (cancelled) return;

    await animate(subText, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2400);
    });
    if (cancelled) return;

    clearInterval(fogInterval);
    clearInterval(dripInterval);

    await Promise.all([
      animate(bg, { alpha: 0, duration: 600 }),
      animate(titleText, { alpha: 0, duration: 400 }),
      animate(subText, { alpha: 0, duration: 400 }),
    ]);
    glow.clear();
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
    clearInterval(fogInterval);
    clearInterval(dripInterval);
    fog.destroy();
    drips.destroy();
    puffTex.destroy(true);
    dropletTex.destroy(true);
    [bg, grateGroup, glow, titleText, subText].forEach((e) => e.destroy());
  };
}
