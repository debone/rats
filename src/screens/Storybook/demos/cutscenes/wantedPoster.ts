import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ASSETS } from '@/assets';

const RATS = [
  { avatar: 1, name: 'NUGGETS', reward: '500 CHEESE', status: 'AT LARGE', statusColor: 0xff4444 },
  { avatar: 2, name: 'NEON', reward: '300 CHEESE', status: 'AT LARGE', statusColor: 0xff4444 },
  { avatar: 3, name: 'RATFATHER', reward: '∞  CHEESE', status: 'UNTOUCHABLE', statusColor: 0xcc44ff },
];

export function wantedPoster(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ratIndex = 0;

  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x000000);
  overlay.alpha = 0;
  root.addChild(overlay);

  const burst = new ParticleEmitter({
    texture: Assets.get(ASSETS.tiles).textures.ball,
    maxParticles: 40,
    emitting: false,
    lifespan: { min: 300, max: 600 },
    speed: { min: 40, max: 140 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.07, max: 0.2 }, end: 0 },
    tint: { start: 0xddcc88, end: 0x886633 },
    alpha: { start: 1, end: 0 },
    rotate: { min: -200, max: 200 },
  });
  burst.x = w / 2;
  burst.y = h / 2;
  root.addChild(burst.container);

  // Parchment card
  const PW = 110;
  const PH = 148;
  const card = new Graphics();
  card
    .roundRect(w / 2 - PW / 2, h / 2 - PH / 2, PW, PH, 3)
    .fill(0xd4b88a)
    .stroke({ color: 0x886633, width: 2 });
  card.alpha = 0;
  card.scale.set(0);
  root.addChild(card);

  // Card inner border
  const cardBorder = new Graphics();
  cardBorder
    .roundRect(w / 2 - PW / 2 + 4, h / 2 - PH / 2 + 4, PW - 8, PH - 8, 2)
    .stroke({ color: 0x886633, width: 1 });
  cardBorder.alpha = 0;
  root.addChild(cardBorder);

  const wantedText = new Text({
    text: 'WANTED',
    style: {
      ...TEXT_STYLE_DEFAULT,
      fontSize: 16,
      letterSpacing: 4,
      fontWeight: 'bold',
      fill: 0x331100,
    },
  });
  wantedText.anchor.set(0.5);
  wantedText.x = w / 2;
  wantedText.y = h / 2 - PH / 2 + 16;
  wantedText.alpha = 0;
  root.addChild(wantedText);

  // Portrait frame on card
  const portraitFrame = new Graphics();
  portraitFrame
    .roundRect(w / 2 - 26, h / 2 - 26, 52, 52, 3)
    .fill(0xc0a070)
    .stroke({ color: 0x886633, width: 1 });
  portraitFrame.alpha = 0;
  root.addChild(portraitFrame);

  const portrait = new Sprite();
  portrait.anchor.set(0.5);
  portrait.width = 46;
  portrait.height = 46;
  portrait.x = w / 2;
  portrait.y = h / 2;
  portrait.alpha = 0;
  portrait.tint = 0xd4b88a;
  root.addChild(portrait);

  const nameText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 2, fontWeight: 'bold', fill: 0x331100 },
  });
  nameText.anchor.set(0.5);
  nameText.x = w / 2;
  nameText.y = h / 2 + 34;
  nameText.alpha = 0;
  root.addChild(nameText);

  const rewardLabel = new Text({
    text: 'REWARD',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, letterSpacing: 3, fill: 0x664422 },
  });
  rewardLabel.anchor.set(0.5);
  rewardLabel.x = w / 2;
  rewardLabel.y = h / 2 + 47;
  rewardLabel.alpha = 0;
  root.addChild(rewardLabel);

  const rewardText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 2, fontWeight: 'bold', fill: 0x331100 },
  });
  rewardText.anchor.set(0.5);
  rewardText.x = w / 2;
  rewardText.y = h / 2 + 57;
  rewardText.alpha = 0;
  root.addChild(rewardText);

  // Status stamp (rotated)
  const stamp = new Text({
    text: '',
    style: {
      ...TEXT_STYLE_DEFAULT,
      fontSize: 13,
      letterSpacing: 3,
      fontWeight: 'bold',
      fill: 0xff4444,
    },
  });
  stamp.anchor.set(0.5);
  stamp.x = w / 2 + 16;
  stamp.y = h / 2 - 20;
  stamp.rotation = -0.4;
  stamp.alpha = 0;
  root.addChild(stamp);

  // Stamp border circle
  const stampRing = new Graphics();
  stampRing.alpha = 0;
  root.addChild(stampRing);

  const play = async () => {
    if (cancelled) return;

    const rat = RATS[ratIndex % RATS.length];
    ratIndex++;

    overlay.alpha = 0;
    card.alpha = 0;
    card.scale.set(0);
    card.rotation = (Math.random() - 0.5) * 0.3;
    cardBorder.alpha = 0;
    wantedText.alpha = 0;
    portraitFrame.alpha = 0;
    portrait.alpha = 0;
    nameText.alpha = 0;
    rewardLabel.alpha = 0;
    rewardText.alpha = 0;
    stamp.alpha = 0;
    stampRing.alpha = 0;
    stamp.scaleX = 0;

    portrait.texture = Assets.get(ASSETS.prototype).textures[`avatars_tile_${rat.avatar}#0`];
    nameText.text = rat.name;
    rewardText.text = rat.reward;
    stamp.text = rat.status;
    stamp.style.fill = rat.statusColor;

    stampRing
      .clear()
      .roundRect(w / 2 - 2, h / 2 - 34, 48, 22, 2)
      .stroke({ color: rat.statusColor, width: 2, alpha: 0.8 });

    await animate(overlay, { alpha: 0.6, duration: 300 });
    if (cancelled) return;

    // Card slams in with rotation wobble
    await animate(card, {
      alpha: 1,
      scaleX: [0, 1.08],
      scaleY: [0, 1.08],
      duration: 420,
      ease: 'outBack(2)',
    });
    await animate(card, { scaleX: 1, scaleY: 1, duration: 180 });
    if (cancelled) return;

    burst.explode(25);

    await animate(cardBorder, { alpha: 1, duration: 200 });
    await animate(wantedText, { alpha: 1, duration: 220 });
    if (cancelled) return;

    await Promise.all([
      animate(portraitFrame, { alpha: 1, duration: 220 }),
      animate(portrait, { alpha: 1, duration: 280 }),
    ]);
    if (cancelled) return;

    await animate(nameText, { alpha: 1, duration: 220 });
    await animate(rewardLabel, { alpha: 1, duration: 180 });
    await animate(rewardText, { alpha: 1, duration: 180 });
    if (cancelled) return;

    // Stamp slaps on — fast
    await new Promise<void>((res) => {
      timer = setTimeout(res, 400);
    });
    if (cancelled) return;

    await Promise.all([
      animate(stamp, { alpha: 1, scaleX: [2, 1], scaleY: [2, 1], duration: 200, ease: 'outBack(3)' }),
      animate(stampRing, { alpha: 1, duration: 180 }),
    ]);
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2000);
    });
    if (cancelled) return;

    await Promise.all([
      animate(overlay, { alpha: 0, duration: 350 }),
      animate(card, { alpha: 0, scaleX: 0.6, scaleY: 0.6, duration: 320, ease: 'inBack(2)' }),
      animate(cardBorder, { alpha: 0, duration: 260 }),
      animate(wantedText, { alpha: 0, duration: 260 }),
      animate(portraitFrame, { alpha: 0, duration: 260 }),
      animate(portrait, { alpha: 0, duration: 260 }),
      animate(nameText, { alpha: 0, duration: 260 }),
      animate(rewardLabel, { alpha: 0, duration: 260 }),
      animate(rewardText, { alpha: 0, duration: 260 }),
      animate(stamp, { alpha: 0, duration: 260 }),
      animate(stampRing, { alpha: 0, duration: 260 }),
    ]);
    card.alpha = 1;
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
    burst.destroy();
    [overlay, card, cardBorder, wantedText, portraitFrame, portrait, nameText, rewardLabel, rewardText, stamp, stampRing].forEach(
      (e) => e.destroy(),
    );
  };
}
