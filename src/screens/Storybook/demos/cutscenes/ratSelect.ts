import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';

const RATS = [
  { avatar: 1, name: 'NUGGETS', role: 'COMMANDER', ability: 'Free ability once per level', color: 0xffee44 },
  { avatar: 2, name: 'NEON', role: 'SPEEDSTER', ability: 'Haste — balls speed up', color: 0x44ffcc },
  { avatar: 3, name: 'RATFATHER', role: 'ELDER', ability: 'More cheese per brick', color: 0xcc8844 },
];

export function ratSelect(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let selectAnim: ReturnType<typeof animate> | null = null;
  let selectedIndex = 0;

  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x040210);
  overlay.alpha = 0;
  root.addChild(overlay);

  const titleText = new Text({
    text: 'SELECT RAT',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 5, fill: 0x664488 },
  });
  titleText.anchor.set(0.5);
  titleText.x = w / 2;
  titleText.y = 18;
  titleText.alpha = 0;
  root.addChild(titleText);

  // Three portrait cards
  const CARD_W = 48;
  const CARD_H = 64;
  const CARD_GAP = 10;
  const totalW = 3 * CARD_W + 2 * CARD_GAP;
  const cardX0 = (w - totalW) / 2;
  const cardY = h / 2 - CARD_H / 2 - 10;

  interface Card {
    bg: Graphics;
    portrait: Sprite;
    nameText: Text;
    roleText: Text;
  }
  const cards: Card[] = [];

  for (let i = 0; i < RATS.length; i++) {
    const rat = RATS[i];
    const cx = cardX0 + i * (CARD_W + CARD_GAP) + CARD_W / 2;

    const bg = new Graphics();
    bg
      .roundRect(cx - CARD_W / 2, cardY, CARD_W, CARD_H, 4)
      .fill(0x0d0d1e)
      .stroke({ color: 0x221133, width: 1 });
    bg.alpha = 0;
    root.addChild(bg);

    const portrait = new Sprite(Assets.get(ASSETS.prototype).textures[`avatars_tile_${rat.avatar}#0`]);
    portrait.anchor.set(0.5);
    portrait.width = 36;
    portrait.height = 36;
    portrait.x = cx;
    portrait.y = cardY + 22;
    portrait.alpha = 0;
    portrait.tint = 0x666688;
    root.addChild(portrait);

    const nameLabel = new Text({
      text: rat.name,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 1, fontWeight: 'bold', fill: 0x665577 },
    });
    nameLabel.anchor.set(0.5);
    nameLabel.x = cx;
    nameLabel.y = cardY + CARD_H - 22;
    nameLabel.alpha = 0;
    root.addChild(nameLabel);

    const roleLabel = new Text({
      text: rat.role,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, letterSpacing: 2, fill: 0x443355 },
    });
    roleLabel.anchor.set(0.5);
    roleLabel.x = cx;
    roleLabel.y = cardY + CARD_H - 10;
    roleLabel.alpha = 0;
    root.addChild(roleLabel);

    cards.push({ bg, portrait, nameText: nameLabel, roleText: roleLabel });
  }

  // Selection highlight frame
  const highlight = new Graphics();
  root.addChild(highlight);

  // Bottom info panel
  const infoBg = new Graphics();
  infoBg
    .roundRect(w / 2 - 80, cardY + CARD_H + 12, 160, 38, 4)
    .fill(0x0d0d1e)
    .stroke({ color: 0x441166, width: 1 });
  infoBg.alpha = 0;
  root.addChild(infoBg);

  const abilityText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xaa88cc, wordWrap: true, wordWrapWidth: 150 },
  });
  abilityText.anchor.set(0.5);
  abilityText.x = w / 2;
  abilityText.y = cardY + CARD_H + 24;
  abilityText.alpha = 0;
  root.addChild(abilityText);

  const drawHighlight = (idx: number, color: number) => {
    const cx = cardX0 + idx * (CARD_W + CARD_GAP) + CARD_W / 2;
    highlight
      .clear()
      .roundRect(cx - CARD_W / 2 - 2, cardY - 2, CARD_W + 4, CARD_H + 4, 5)
      .stroke({ color, width: 2 });
  };

  const activateCard = async (idx: number) => {
    if (cancelled) return;
    const rat = RATS[idx];
    const card = cards[idx];

    // Highlight this card, dim others
    cards.forEach((c, i) => {
      animate(c.portrait, { alpha: i === idx ? 1 : 0.3, duration: 250 });
      c.portrait.tint = i === idx ? rat.color : 0x666688;
      animate(c.bg, {
        scaleX: i === idx ? 1.06 : 1,
        scaleY: i === idx ? 1.06 : 1,
        duration: 250,
        ease: 'outBack',
      });
      animate(c.nameText, { alpha: i === idx ? 1 : 0.4, duration: 250 });
      animate(c.roleText, { alpha: i === idx ? 0.8 : 0.2, duration: 250 });
    });

    drawHighlight(idx, rat.color);

    // Update info panel
    abilityText.text = rat.ability;
    abilityText.style.fill = rat.color;
    await Promise.all([
      animate(infoBg, { alpha: 1, duration: 250 }),
      animate(abilityText, { alpha: 1, duration: 250 }),
    ]);
  };

  const play = async () => {
    if (cancelled) return;

    selectedIndex = 0;
    overlay.alpha = 0;
    titleText.alpha = 0;
    cards.forEach((c) => {
      c.bg.alpha = 0;
      c.portrait.alpha = 0;
      c.portrait.tint = 0x666688;
      c.nameText.alpha = 0;
      c.roleText.alpha = 0;
      c.bg.scale.set(1);
    });
    highlight.clear();
    infoBg.alpha = 0;
    abilityText.alpha = 0;

    await animate(overlay, { alpha: 1, duration: 350 });
    if (cancelled) return;

    await animate(titleText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    // Cards pop in staggered
    for (let i = 0; i < cards.length; i++) {
      if (cancelled) return;
      const c = cards[i];
      animate(c.bg, { alpha: 1, scaleY: [0, 1], duration: 280, ease: 'outBack' });
      animate(c.portrait, { alpha: 0.3, duration: 280, delay: 60 });
      animate(c.nameText, { alpha: 0.4, duration: 260, delay: 80 });
      animate(c.roleText, { alpha: 0.2, duration: 260, delay: 100 });

      await new Promise<void>((res) => {
        timer = setTimeout(res, 120);
      });
    }
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 200);
    });
    if (cancelled) return;

    // Cycle through rats selecting each one
    for (let i = 0; i < RATS.length; i++) {
      if (cancelled) return;
      await activateCard(i);

      await new Promise<void>((res) => {
        timer = setTimeout(res, 900);
      });
    }
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 800);
    });
    if (cancelled) return;

    // Fade out
    selectAnim?.cancel();
    await Promise.all([
      animate(overlay, { alpha: 0, duration: 400 }),
      animate(titleText, { alpha: 0, duration: 300 }),
      animate(infoBg, { alpha: 0, duration: 300 }),
      animate(abilityText, { alpha: 0, duration: 300 }),
      ...cards.flatMap((c) => [
        animate(c.bg, { alpha: 0, duration: 280 }),
        animate(c.portrait, { alpha: 0, duration: 280 }),
        animate(c.nameText, { alpha: 0, duration: 280 }),
        animate(c.roleText, { alpha: 0, duration: 280 }),
      ]),
    ]);
    highlight.clear();
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
    selectAnim?.cancel();
    [
      overlay,
      titleText,
      highlight,
      infoBg,
      abilityText,
      ...cards.flatMap((c) => [c.bg, c.portrait, c.nameText, c.roleText]),
    ].forEach((e) => e.destroy());
  };
}
