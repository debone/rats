import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ASSETS } from '@/assets';

const ITEMS = [
  { name: 'CHEESE WEDGE', desc: '+50 score per cheese', color: 0xffee44, avatar: 'cheese_tile_1#0' },
  { name: 'SPEED RUNE', desc: 'Ball speed ×1.5 for 10s', color: 0x44ccff, avatar: 'avatars_tile_2#0' },
  { name: 'BRICK BUSTER', desc: 'Next ball destroys 3 bricks', color: 0xcc44ff, avatar: 'bricks_tile_2#0' },
];

export function itemPickup(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let itemIndex = 0;
  let floatAnim: ReturnType<typeof animate> | null = null;

  // Box (chest) — two halves that split open
  const BOX_W = 38;
  const BOX_H = 26;
  const bx = w / 2 - BOX_W / 2;
  const by = h / 2 + 14;

  const boxBottom = new Graphics();
  boxBottom
    .roundRect(bx, by + BOX_H / 2, BOX_W, BOX_H / 2, 3)
    .fill(0x553311)
    .stroke({ color: 0x886633, width: 1 });
  boxBottom.alpha = 0;
  root.addChild(boxBottom);

  const boxTop = new Graphics();
  boxTop
    .roundRect(bx, by, BOX_W, BOX_H / 2 + 2, { tl: 3, tr: 3, bl: 0, br: 0 })
    .fill(0x775533)
    .stroke({ color: 0xaa8855, width: 1 });
  boxTop.alpha = 0;
  root.addChild(boxTop);

  // Lock clasp on box
  const clasp = new Graphics();
  clasp
    .roundRect(w / 2 - 5, by + BOX_H / 2 - 4, 10, 8, 2)
    .fill(0xddaa44)
    .stroke({ color: 0xaa7722, width: 1 });
  clasp.alpha = 0;
  root.addChild(clasp);

  // Item sprite (hidden until box opens)
  const itemSprite = new Sprite();
  itemSprite.anchor.set(0.5);
  itemSprite.width = 28;
  itemSprite.height = 28;
  itemSprite.x = w / 2;
  itemSprite.y = by + BOX_H / 2;
  itemSprite.alpha = 0;
  root.addChild(itemSprite);

  // Sparkles
  const sparkles = new ParticleEmitter({
    texture: Assets.get(ASSETS.tiles).textures.ball,
    maxParticles: 50,
    emitting: false,
    lifespan: { min: 400, max: 900 },
    speed: { min: 20, max: 100 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.06, max: 0.2 }, end: 0 },
    tint: { start: 0xffee44, end: 0x9944bb },
    alpha: { start: 1, end: 0 },
  });
  sparkles.x = w / 2;
  sparkles.y = by;
  root.addChild(sparkles.container);

  // Glow under item
  const glow = new Graphics();
  root.addChild(glow);

  // Name banner
  const nameBg = new Graphics();
  nameBg
    .roundRect(w / 2 - 70, h / 2 - 50, 140, 20, 4)
    .fill(0x0d0d1e)
    .stroke({ color: 0x441166, width: 1 });
  nameBg.alpha = 0;
  root.addChild(nameBg);

  const nameText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 2, fontWeight: 'bold', fill: 0xffffff },
  });
  nameText.anchor.set(0.5);
  nameText.x = w / 2;
  nameText.y = h / 2 - 40;
  nameText.alpha = 0;
  root.addChild(nameText);

  const descText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x9988bb },
  });
  descText.anchor.set(0.5);
  descText.x = w / 2;
  descText.y = h / 2 - 24;
  descText.alpha = 0;
  root.addChild(descText);

  const hintText = new Text({
    text: '— ACQUIRED —',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 4, fill: 0x443355 },
  });
  hintText.anchor.set(0.5);
  hintText.x = w / 2;
  hintText.y = h / 2 + 58;
  hintText.alpha = 0;
  root.addChild(hintText);

  let hintPulse: ReturnType<typeof animate> | null = null;

  const play = async () => {
    if (cancelled) return;

    const item = ITEMS[itemIndex % ITEMS.length];
    itemIndex++;

    // Reset
    boxBottom.alpha = 0;
    boxTop.alpha = 0;
    boxTop.y = 0;
    clasp.alpha = 0;
    itemSprite.alpha = 0;
    itemSprite.y = by + BOX_H / 2;
    glow.clear();
    nameBg.alpha = 0;
    nameText.alpha = 0;
    descText.alpha = 0;
    hintText.alpha = 0;
    floatAnim?.cancel();
    hintPulse?.cancel();

    itemSprite.texture = Assets.get(ASSETS.prototype).textures[item.avatar];
    itemSprite.tint = item.color;
    nameText.text = item.name;
    nameText.style.fill = item.color;
    descText.text = item.desc;

    // Box appears
    await Promise.all([
      animate(boxBottom, { alpha: 1, duration: 250 }),
      animate(boxTop, { alpha: 1, duration: 250 }),
      animate(clasp, { alpha: 1, duration: 250 }),
    ]);
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 400);
    });
    if (cancelled) return;

    // Box lid flies open (upward) and clasp fades
    await Promise.all([
      animate(boxTop, { y: -BOX_H - 10, alpha: 0, duration: 320, ease: 'outBack(1.5)' }),
      animate(clasp, { alpha: 0, duration: 200 }),
    ]);
    if (cancelled) return;

    // Item floats up out of box
    sparkles.explode(40);

    await animate(itemSprite, {
      y: h / 2 - 34,
      alpha: 1,
      scaleX: [0.3, 1.1],
      scaleY: [0.3, 1.1],
      duration: 450,
      ease: 'outBack(2)',
    });
    await animate(itemSprite, { scaleX: 1, scaleY: 1, duration: 200 });
    if (cancelled) return;

    // Glow halo beneath item
    const gp = { alpha: 0 };
    animate(gp, {
      alpha: 0.3,
      duration: 400,
      onUpdate: () => {
        glow
          .clear()
          .circle(w / 2, h / 2 - 34, 24)
          .fill({ color: item.color, alpha: gp.alpha });
      },
    });

    // Name and desc stagger in
    await animate(nameBg, { alpha: 1, duration: 250 });
    await animate(nameText, { alpha: 1, duration: 220 });
    await animate(descText, { alpha: 1, duration: 220 });
    if (cancelled) return;

    // Item idle float
    const baseY = h / 2 - 34;
    const doFloat = () => {
      floatAnim = animate(itemSprite, { y: baseY - 5, duration: 900, ease: 'inOutSine' });
      floatAnim.then(() => {
        floatAnim = animate(itemSprite, { y: baseY, duration: 900, ease: 'inOutSine' });
        floatAnim.then(() => {
          if (!cancelled) doFloat();
        });
      });
    };
    doFloat();

    await animate(hintText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    hintPulse = animate(hintText, { alpha: [1, 0.2, 1], duration: 900, loop: true });

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2200);
    });
    if (cancelled) return;

    floatAnim?.cancel();
    hintPulse.cancel();

    await Promise.all([
      animate(boxBottom, { alpha: 0, duration: 300 }),
      animate(itemSprite, { alpha: 0, scaleX: 0, scaleY: 0, duration: 320, ease: 'inBack(2)' }),
      animate(nameBg, { alpha: 0, duration: 280 }),
      animate(nameText, { alpha: 0, duration: 280 }),
      animate(descText, { alpha: 0, duration: 280 }),
      animate(hintText, { alpha: 0, duration: 280 }),
    ]);
    glow.clear();
    itemSprite.alpha = 1;
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
    floatAnim?.cancel();
    hintPulse?.cancel();
    sparkles.destroy();
    [boxBottom, boxTop, clasp, itemSprite, glow, nameBg, nameText, descText, hintText].forEach((e) => e.destroy());
  };
}
