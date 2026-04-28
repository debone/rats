import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';

const PAGES = [
  {
    avatar: 1,
    speaker: 'NUGGETS',
    color: 0xffee44,
    text: "We need to break through those walls. The cheese is on the other side, and I'm not leaving without it.",
  },
  {
    avatar: 2,
    speaker: 'NEON',
    color: 0x44ffcc,
    text: "Leave it to me. One burst of speed and those bricks won't know what hit them.",
  },
  {
    avatar: 3,
    speaker: 'RATFATHER',
    color: 0xcc8844,
    text: 'Every brick has a price. Break them wisely and the cheese vault is ours.',
  },
];

export function dialogBox(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let pageIndex = 0;
  let typingAnim: ReturnType<typeof animate> | null = null;
  let blinkAnim: ReturnType<typeof animate> | null = null;
  let typingDone = false;

  const PANEL_H = 72;

  const group = new Container();
  group.y = PANEL_H + 10;
  group.alpha = 0;
  root.addChild(group);

  const PY = h - PANEL_H - 8;
  const panel = new Graphics();
  panel
    .roundRect(8, PY, w - 16, PANEL_H, 6)
    .fill(0x0d0d1e)
    .stroke({ color: 0x441166, width: 1 });
  group.addChild(panel);

  const portraitBg = new Graphics();
  portraitBg
    .circle(30, PY + PANEL_H / 2, 22)
    .fill(0x1a1033)
    .stroke({ color: 0x441166, width: 1 });
  group.addChild(portraitBg);

  const portrait = new Sprite();
  portrait.anchor.set(0.5);
  portrait.width = 36;
  portrait.height = 36;
  portrait.x = 30;
  portrait.y = PY + PANEL_H / 2;
  group.addChild(portrait);

  const speakerText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 2, fontWeight: 'bold' },
  });
  speakerText.x = 60;
  speakerText.y = PY + 10;
  group.addChild(speakerText);

  const dialogText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0xccbbdd, wordWrap: true, wordWrapWidth: w - 80 },
  });
  dialogText.x = 60;
  dialogText.y = PY + 26;
  group.addChild(dialogText);

  const cursor = new Text({
    text: '▼',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x9944bb },
  });
  cursor.anchor.set(1, 1);
  cursor.x = w - 18;
  cursor.y = h - 10;
  cursor.alpha = 0;
  group.addChild(cursor);

  const showPage = async (idx: number) => {
    if (cancelled) return;
    blinkAnim?.cancel();
    cursor.alpha = 0;
    typingDone = false;

    const page = PAGES[idx % PAGES.length];
    portrait.texture = Assets.get(ASSETS.prototype).textures[`avatars_tile_${page.avatar}#0`];
    speakerText.text = page.speaker;
    speakerText.style.fill = page.color;

    portrait.scale.set(0);
    animate(portrait, { scaleX: 1, scaleY: 1, duration: 250, ease: 'outBack(2)' });

    dialogText.text = '';
    const fullText = page.text;
    const proxy = { n: 0 };
    typingAnim = animate(proxy, {
      n: fullText.length,
      duration: fullText.length * 36,
      ease: 'linear',
      onUpdate: () => {
        dialogText.text = fullText.slice(0, Math.floor(proxy.n));
      },
    });
    await typingAnim;
    if (cancelled) return;

    typingDone = true;
    blinkAnim = animate(cursor, { alpha: [1, 0, 1], duration: 700, loop: true });
  };

  const advance = () => {
    if (!typingDone) {
      typingAnim?.cancel();
      const page = PAGES[pageIndex % PAGES.length];
      dialogText.text = page.text;
      typingDone = true;
      blinkAnim = animate(cursor, { alpha: [1, 0, 1], duration: 700, loop: true });
      return;
    }
    pageIndex++;
    blinkAnim?.cancel();
    cursor.alpha = 0;
    showPage(pageIndex);
  };

  const hitArea = new Graphics();
  hitArea.rect(0, 0, w, h).fill({ color: 0, alpha: 0 });
  hitArea.interactive = true;
  hitArea.on('pointertap', advance);
  root.addChild(hitArea);

  const hint = new Text({
    text: 'click to advance dialog',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x443355 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = 12;
  root.addChild(hint);

  const open = async () => {
    await animate(group, { y: 0, alpha: 1, duration: 380, ease: 'outBack(1.2)' });
    if (!cancelled) showPage(pageIndex);
  };

  open();

  return () => {
    cancelled = true;
    typingAnim?.cancel();
    blinkAnim?.cancel();
    group.destroy({ children: true });
    hitArea.destroy();
    hint.destroy();
  };
}
