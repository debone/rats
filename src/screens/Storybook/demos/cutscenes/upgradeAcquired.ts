import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { ASSETS } from '@/assets';

const UPGRADES = [
  {
    name: 'STEEL BALL',
    desc: 'Penetrates 2 bricks per hit',
    stats: [
      { label: 'POWER', before: 3, after: 7, color: 0xff6644 },
      { label: 'SPEED', before: 5, after: 5, color: 0x44ccff },
      { label: 'RANGE', before: 2, after: 6, color: 0xcc44ff },
    ],
    color: 0xaaaacc,
  },
  {
    name: 'TURBO FEET',
    desc: 'Paddle moves 40% faster',
    stats: [
      { label: 'POWER', before: 4, after: 4, color: 0xff6644 },
      { label: 'SPEED', before: 3, after: 9, color: 0x44ccff },
      { label: 'RANGE', before: 4, after: 4, color: 0xcc44ff },
    ],
    color: 0x44ffcc,
  },
];

const BAR_MAX = 10;

export function upgradeAcquired(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let upgradeIndex = 0;

  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x000000);
  overlay.alpha = 0;
  root.addChild(overlay);

  const sparkle = new ParticleEmitter({
    texture: Assets.get(ASSETS.tiles).textures.ball,
    maxParticles: 50,
    emitting: false,
    lifespan: { min: 400, max: 900 },
    speed: { min: 30, max: 120 },
    angle: { min: 0, max: 360 },
    scale: { start: { min: 0.08, max: 0.22 }, end: 0 },
    tint: { start: 0xffffff, end: 0x9944bb },
    alpha: { start: 1, end: 0 },
    rotate: { min: -300, max: 300 },
  });
  sparkle.x = w / 2;
  sparkle.y = h / 2 - 44;
  root.addChild(sparkle.container);

  const bannerText = new Text({
    text: 'UPGRADE ACQUIRED',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 5, fill: 0x9944bb },
  });
  bannerText.anchor.set(0.5);
  bannerText.x = w / 2;
  bannerText.y = h / 2 - 64;
  bannerText.alpha = 0;
  root.addChild(bannerText);

  const icon = new Sprite(Assets.get(ASSETS.tiles).textures.ball);
  icon.anchor.set(0.5);
  icon.scale.set(0);
  icon.x = w / 2;
  icon.y = h / 2 - 44;
  root.addChild(icon);

  const nameText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 3, fontWeight: 'bold', fill: 0xffffff },
  });
  nameText.anchor.set(0.5);
  nameText.x = w / 2;
  nameText.y = h / 2 - 14;
  nameText.alpha = 0;
  root.addChild(nameText);

  const descText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x9988bb },
  });
  descText.anchor.set(0.5);
  descText.x = w / 2;
  descText.y = h / 2 + 4;
  descText.alpha = 0;
  root.addChild(descText);

  // Stat bars (3 rows)
  const BAR_Y0 = h / 2 + 22;
  const BAR_H = 16;
  const BAR_W = w - 60;
  const BAR_X = 30;

  interface BarRow {
    label: Text;
    bg: Graphics;
    before: Graphics;
    after: Graphics;
    plusText: Text;
  }
  const barRows: BarRow[] = [];

  for (let i = 0; i < 3; i++) {
    const by = BAR_Y0 + i * BAR_H;

    const label = new Text({
      text: '',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x665588 },
    });
    label.x = BAR_X;
    label.y = by;
    label.alpha = 0;
    root.addChild(label);

    const bg = new Graphics();
    bg
      .roundRect(BAR_X + 40, by, BAR_W - 40, 7, 2)
      .fill(0x111122);
    bg.alpha = 0;
    root.addChild(bg);

    const before = new Graphics();
    root.addChild(before);

    const after = new Graphics();
    root.addChild(after);

    const plusText = new Text({
      text: '',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x44ff88 },
    });
    plusText.anchor.set(0, 0.5);
    plusText.x = BAR_X + BAR_W + 4;
    plusText.y = by + 4;
    plusText.alpha = 0;
    root.addChild(plusText);

    barRows.push({ label, bg, before, after, plusText });
  }

  const play = async () => {
    if (cancelled) return;

    const upg = UPGRADES[upgradeIndex % UPGRADES.length];
    upgradeIndex++;

    // Reset
    overlay.alpha = 0;
    bannerText.alpha = 0;
    icon.scale.set(0);
    icon.tint = upg.color;
    nameText.alpha = 0;
    descText.alpha = 0;
    nameText.text = upg.name;
    descText.text = upg.desc;
    barRows.forEach((r) => {
      r.label.alpha = 0;
      r.bg.alpha = 0;
      r.before.clear();
      r.after.clear();
      r.plusText.alpha = 0;
    });

    await animate(overlay, { alpha: 0.75, duration: 350 });
    if (cancelled) return;

    await animate(bannerText, { alpha: 1, duration: 280 });
    if (cancelled) return;

    // Icon spins in
    await animate(icon, {
      scaleX: [0, 1.15],
      scaleY: [0, 1.15],
      rotation: Math.PI * 2,
      duration: 500,
      ease: 'outBack(2)',
    });
    await animate(icon, { scaleX: 1, scaleY: 1, duration: 180 });
    if (cancelled) return;

    sparkle.explode(40);

    await animate(nameText, { alpha: 1, scaleX: [0.7, 1], scaleY: [0.7, 1], duration: 320, ease: 'outBack(1.5)' });
    if (cancelled) return;
    await animate(descText, { alpha: 1, duration: 240 });
    if (cancelled) return;

    // Stats animate in with growing bars
    for (let i = 0; i < upg.stats.length; i++) {
      if (cancelled) return;
      const stat = upg.stats[i];
      const { label, bg, before, after, plusText } = barRows[i];
      const by = BAR_Y0 + i * BAR_H;
      const bx = BAR_X + 40;
      const maxW = BAR_W - 40;
      const beforeW = (stat.before / BAR_MAX) * maxW;
      const afterW = (stat.after / BAR_MAX) * maxW;
      const diff = stat.after - stat.before;

      label.text = stat.label;
      await animate(label, { alpha: 1, duration: 160 });
      await animate(bg, { alpha: 1, duration: 140 });

      // Before bar fills immediately
      before
        .clear()
        .roundRect(bx, by, beforeW, 7, 2)
        .fill({ color: stat.color, alpha: 0.35 });

      // After bar grows
      const bp = { w: beforeW };
      await animate(bp, {
        w: afterW,
        duration: 350,
        ease: 'outQuad',
        onUpdate: () => {
          after
            .clear()
            .roundRect(bx, by, bp.w, 7, 2)
            .fill({ color: stat.color, alpha: 0.9 });
        },
      });
      if (cancelled) return;

      if (diff !== 0) {
        plusText.text = diff > 0 ? `+${diff}` : `${diff}`;
        plusText.style.fill = diff > 0 ? 0x44ff88 : 0xff4444;
        await animate(plusText, { alpha: 1, scaleX: [1.4, 1], scaleY: [1.4, 1], duration: 260, ease: 'outBack' });
      }

      await new Promise<void>((res) => {
        timer = setTimeout(res, 80);
      });
    }
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 1800);
    });
    if (cancelled) return;

    // Fade out
    await Promise.all([
      animate(overlay, { alpha: 0, duration: 400 }),
      animate(bannerText, { alpha: 0, duration: 300 }),
      animate(icon, { alpha: 0, scaleX: 0, scaleY: 0, duration: 320, ease: 'inBack(2)' }),
      animate(nameText, { alpha: 0, duration: 280 }),
      animate(descText, { alpha: 0, duration: 280 }),
      ...barRows.flatMap((r) => [
        animate(r.label, { alpha: 0, duration: 240 }),
        animate(r.bg, { alpha: 0, duration: 240 }),
        animate(r.plusText, { alpha: 0, duration: 240 }),
      ]),
    ]);
    barRows.forEach((r) => {
      r.before.clear();
      r.after.clear();
    });
    icon.alpha = 1;
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
    sparkle.destroy();
    [
      overlay,
      bannerText,
      icon,
      nameText,
      descText,
      ...barRows.flatMap((r) => [r.label, r.bg, r.before, r.after, r.plusText]),
    ].forEach((e) => e.destroy());
  };
}
