import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';

const SCENES = [
  {
    line1: 'Three rats.',
    line2: 'One vault.',
    line3: 'No plan survives contact with the cheese.',
    color: 0x9944bb,
  },
  {
    line1: 'The walls are just the beginning.',
    line2: 'Beyond them lies everything.',
    line3: "Don't stop. Don't look back.",
    color: 0x44ccff,
  },
  {
    line1: 'Every heist has a cost.',
    line2: 'Tonight, we pay in bricks.',
    line3: 'The Ratfather watches. Always.',
    color: 0xcc8844,
  },
];

const BAR_H = 32;

export function cinematicLetterbox(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sceneIndex = 0;

  // Cinematic bars (black, slide in from edges)
  const barTop = new Graphics();
  barTop.rect(0, 0, w, BAR_H).fill(0x000000);
  barTop.y = -BAR_H;
  root.addChild(barTop);

  const barBot = new Graphics();
  barBot.rect(0, h - BAR_H, w, BAR_H).fill(0x000000);
  barBot.y = BAR_H;
  root.addChild(barBot);

  // Subtle background "scene" (avatar + environment hint)
  const sceneBg = new Graphics();
  sceneBg.rect(0, 0, w, h).fill(0x080614);
  sceneBg.alpha = 0;
  root.addChild(sceneBg);

  const ratSprite = new Sprite(Assets.get(ASSETS.prototype).textures['avatars_tile_1#0']);
  ratSprite.anchor.set(0.5);
  ratSprite.width = 80;
  ratSprite.height = 80;
  ratSprite.x = w / 2;
  ratSprite.y = h / 2;
  ratSprite.alpha = 0;
  ratSprite.tint = 0x221133;
  root.addChild(ratSprite);

  // Text lines
  const line1 = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0x9977aa, letterSpacing: 1 },
  });
  line1.anchor.set(0.5);
  line1.x = w / 2;
  line1.y = h / 2 - 20;
  line1.alpha = 0;
  root.addChild(line1);

  const line2 = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0xccbbdd, letterSpacing: 1 },
  });
  line2.anchor.set(0.5);
  line2.x = w / 2;
  line2.y = h / 2 - 4;
  line2.alpha = 0;
  root.addChild(line2);

  const line3 = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x554466, letterSpacing: 2 },
  });
  line3.anchor.set(0.5);
  line3.x = w / 2;
  line3.y = h / 2 + 14;
  line3.alpha = 0;
  root.addChild(line3);

  // Subtle color accent line
  const accentLine = new Graphics();
  root.addChild(accentLine);

  const play = async () => {
    if (cancelled) return;

    const scene = SCENES[sceneIndex % SCENES.length];
    sceneIndex++;

    barTop.y = -BAR_H;
    barBot.y = BAR_H;
    sceneBg.alpha = 0;
    ratSprite.alpha = 0;
    ratSprite.x = w / 2 + 20;
    line1.alpha = 0;
    line2.alpha = 0;
    line3.alpha = 0;
    accentLine.clear();
    line1.text = scene.line1;
    line2.text = scene.line2;
    line3.text = scene.line3;

    // Bars slide in
    await Promise.all([
      animate(barTop, { y: 0, duration: 380, ease: 'outQuad' }),
      animate(barBot, { y: 0, duration: 380, ease: 'outQuad' }),
      animate(sceneBg, { alpha: 1, duration: 500 }),
    ]);
    if (cancelled) return;

    // Background rat drifts slowly (fake camera pan)
    animate(ratSprite, { x: w / 2 - 20, alpha: 0.08, duration: 3000, ease: 'linear' });

    // Accent line in lower bar
    const lp = { w: 0 };
    animate(lp, {
      w: 60,
      duration: 500,
      ease: 'outQuad',
      onUpdate: () => {
        accentLine
          .clear()
          .rect(w / 2 - lp.w / 2, h - BAR_H + 14, lp.w, 1)
          .fill({ color: scene.color, alpha: 0.7 });
      },
    });

    await new Promise<void>((res) => {
      timer = setTimeout(res, 180);
    });
    if (cancelled) return;

    // Lines stagger in — each slightly below then rises
    line1.y = h / 2 - 14;
    await animate(line1, { alpha: 1, y: h / 2 - 20, duration: 450, ease: 'outQuad' });
    if (cancelled) return;

    line2.y = h / 2 + 2;
    await animate(line2, { alpha: 1, y: h / 2 - 4, duration: 350, ease: 'outQuad' });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 300);
    });
    if (cancelled) return;

    await animate(line3, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 1800);
    });
    if (cancelled) return;

    // Bars retract
    await Promise.all([
      animate(barTop, { y: -BAR_H, duration: 360, ease: 'inQuad' }),
      animate(barBot, { y: BAR_H, duration: 360, ease: 'inQuad' }),
      animate(sceneBg, { alpha: 0, duration: 400 }),
      animate(line1, { alpha: 0, duration: 300 }),
      animate(line2, { alpha: 0, duration: 300 }),
      animate(line3, { alpha: 0, duration: 300 }),
    ]);
    accentLine.clear();
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 500);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    [barTop, barBot, sceneBg, ratSprite, line1, line2, line3, accentLine].forEach((e) => e.destroy());
  };
}
