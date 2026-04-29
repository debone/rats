import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';
import { app } from '@/main';

const NUM_RATS = 9;

interface RatState {
  sprite: Sprite;
  speed: number;
  yOffset: number;
  bobOffset: number;
}

export function ratHorde(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x050608);
  bg.alpha = 0;
  root.addChild(bg);

  // Tunnel arch — two bezier curves top and bottom
  const tunnel = new Graphics();
  tunnel
    .moveTo(0, cy - 22)
    .bezierCurveTo(w * 0.3, cy - 40, w * 0.7, cy - 40, w, cy - 22)
    .stroke({ color: 0x2a2218, width: 2 });
  tunnel
    .moveTo(0, cy + 22)
    .bezierCurveTo(w * 0.3, cy + 36, w * 0.7, cy + 36, w, cy + 22)
    .stroke({ color: 0x2a2218, width: 2 });
  tunnel
    .moveTo(0, cy + 22)
    .lineTo(w, cy + 22)
    .stroke({ color: 0x1a1810, width: 1 });
  tunnel.alpha = 0;
  root.addChild(tunnel);

  // Paw print trail accumulated over time
  const paws = new Graphics();
  root.addChild(paws);

  // Rats
  const atlas = Assets.get(ASSETS.prototype);
  const rats: RatState[] = [];

  for (let i = 0; i < NUM_RATS; i++) {
    const sprite = new Sprite(atlas.textures['avatars_tile_1#0']);
    sprite.anchor.set(0.5);
    sprite.width = 20;
    sprite.height = 20;
    sprite.tint = 0x3a3028;
    sprite.x = -30 - i * 22;
    sprite.y = cy + 10 + (i % 3 - 1) * 7;
    sprite.alpha = 0;
    root.addChild(sprite);

    rats.push({
      sprite,
      speed: 55 + Math.random() * 30,
      yOffset: (i % 3 - 1) * 7,
      bobOffset: i * 1.1,
    });
  }

  const titleText = new Text({
    text: 'THE HORDE',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, letterSpacing: 5, fill: 0x6a5a3a, fontWeight: 'bold' },
  });
  titleText.anchor.set(0.5);
  titleText.x = w / 2;
  titleText.y = cy - 30;
  titleText.alpha = 0;
  root.addChild(titleText);

  let pawPrintTimer = 0;

  const tick = (dt: { deltaMS: number }) => {
    if (!running || cancelled) return;

    const delta = dt.deltaMS / 1000;
    pawPrintTimer += dt.deltaMS;

    rats.forEach((rat) => {
      rat.sprite.x += rat.speed * delta;

      rat.sprite.y = cy + 10 + rat.yOffset + Math.sin(rat.sprite.x * 0.18 + rat.bobOffset) * 1.5;

      if (rat.sprite.x > w + 30) {
        rat.sprite.x = -30 - Math.random() * 20;
      }
    });

    if (pawPrintTimer > 200) {
      pawPrintTimer = 0;
      const rat = rats[Math.floor(Math.random() * NUM_RATS)];
      if (rat.sprite.x > 10 && rat.sprite.x < w - 10) {
        paws
          .circle(rat.sprite.x + (Math.random() - 0.5) * 8, rat.sprite.y + 8 + Math.random() * 4, 1.5)
          .fill({ color: 0x3a3028, alpha: 0.5 });
      }
    }
  };

  app.ticker.add(tick);

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    tunnel.alpha = 0;
    paws.clear();
    titleText.alpha = 0;
    running = false;

    rats.forEach((rat, i) => {
      rat.sprite.x = -30 - i * 22;
      rat.sprite.y = cy + 10 + rat.yOffset;
      rat.sprite.alpha = 0;
      rat.speed = 55 + Math.random() * 30;
    });

    await animate(bg, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await animate(tunnel, { alpha: 1, duration: 400 });
    if (cancelled) return;

    running = true;
    await Promise.all(
      rats.map((rat, i) =>
        animate(rat.sprite, {
          alpha: 0.85,
          duration: 300,
          delay: i * 80,
        }),
      ),
    );
    if (cancelled) return;

    await animate(titleText, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2600);
    });
    if (cancelled) return;

    running = false;

    await Promise.all([
      animate(bg, { alpha: 0, duration: 500 }),
      animate(tunnel, { alpha: 0, duration: 400 }),
      animate(titleText, { alpha: 0, duration: 400 }),
      ...rats.map((rat) => animate(rat.sprite, { alpha: 0, duration: 350 })),
    ]);
    paws.clear();
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    running = false;
    if (timer) clearTimeout(timer);
    app.ticker.remove(tick);
    [bg, tunnel, paws, titleText, ...rats.map((r) => r.sprite)].forEach((e) => e.destroy());
  };
}
