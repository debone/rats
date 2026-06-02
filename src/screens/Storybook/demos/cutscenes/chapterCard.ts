import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const CHAPTERS = [
  { num: 'I', title: 'THE CHEESE VAULT', subtitle: 'Deep beneath the city, a legend.' },
  { num: 'II', title: 'NEON TUNNELS', subtitle: 'Speed is the only currency here.' },
  { num: 'III', title: 'THE RATFATHER', subtitle: 'Every empire has its price.' },
];

export function chapterCard(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chapterIndex = 0;

  // Letterbox bars
  const barTop = new Graphics();
  barTop.rect(0, 0, w, 28).fill(0x000000);
  barTop.y = -28;
  root.addChild(barTop);

  const barBot = new Graphics();
  barBot.rect(0, h - 28, w, 28).fill(0x000000);
  barBot.y = 28;
  root.addChild(barBot);

  // Full dark overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x000000);
  overlay.alpha = 0;
  root.addChild(overlay);

  // Horizontal line (grows from center)
  const line = new Graphics();
  root.addChild(line);

  // Chapter number (roman numeral, large)
  const numText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 6, fill: 0x9944bb },
  });
  numText.anchor.set(0.5);
  numText.x = w / 2;
  numText.y = h / 2 - 28;
  numText.alpha = 0;
  root.addChild(numText);

  // Chapter title (big, letterSpaced)
  const titleText = new Text({
    text: '',
    style: {
      ...TEXT_STYLE_DEFAULT,
      fontSize: 18,
      letterSpacing: 5,
      fontWeight: 'bold',
      fill: 0xffffff,
    },
  });
  titleText.anchor.set(0.5);
  titleText.x = w / 2;
  titleText.y = h / 2 - 4;
  titleText.alpha = 0;
  root.addChild(titleText);

  // Subtitle (typewriter reveal)
  const subtitleText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x665588, letterSpacing: 2 },
  });
  subtitleText.anchor.set(0.5);
  subtitleText.x = w / 2;
  subtitleText.y = h / 2 + 22;
  subtitleText.alpha = 0;
  root.addChild(subtitleText);

  const play = async () => {
    if (cancelled) return;

    const ch = CHAPTERS[chapterIndex % CHAPTERS.length];
    chapterIndex++;

    // Reset
    barTop.y = -28;
    barBot.y = 28;
    overlay.alpha = 0;
    line.clear();
    numText.alpha = 0;
    titleText.alpha = 0;
    subtitleText.alpha = 0;
    subtitleText.text = '';
    numText.text = `CHAPTER  ${ch.num}`;
    titleText.text = ch.title;

    // Letterbox bars slide in
    await Promise.all([
      animate(barTop, { y: 0, duration: 400, ease: 'outQuad' }),
      animate(barBot, { y: 0, duration: 400, ease: 'outQuad' }),
      animate(overlay, { alpha: 0.85, duration: 400 }),
    ]);
    if (cancelled) return;

    // Line grows from center outward
    const lp = { w: 0 };
    await animate(lp, {
      w: w / 2,
      duration: 500,
      ease: 'outQuad',
      onUpdate: () => {
        line
          .clear()
          .rect(w / 2 - lp.w, h / 2 - 40, lp.w * 2, 1)
          .fill(0x9944bb);
      },
    });
    if (cancelled) return;

    // Chapter label fades in
    await animate(numText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    // Title scales in
    await animate(titleText, { alpha: 1, scaleX: [0.85, 1], scaleY: [0.85, 1], duration: 400, ease: 'outBack(1.5)' });
    if (cancelled) return;

    // Subtitle types out
    const full = ch.subtitle;
    const proxy = { n: 0 };
    subtitleText.alpha = 1;
    await animate(proxy, {
      n: full.length,
      duration: full.length * 45,
      ease: 'linear',
      onUpdate: () => {
        subtitleText.text = full.slice(0, Math.floor(proxy.n));
      },
    });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 1600);
    });
    if (cancelled) return;

    // Fade and retract bars
    await Promise.all([
      animate(barTop, { y: -28, duration: 380, ease: 'inQuad' }),
      animate(barBot, { y: 28, duration: 380, ease: 'inQuad' }),
      animate(overlay, { alpha: 0, duration: 400 }),
      animate(titleText, { alpha: 0, duration: 300 }),
      animate(numText, { alpha: 0, duration: 300 }),
      animate(subtitleText, { alpha: 0, duration: 300 }),
    ]);
    line.clear();
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
    [barTop, barBot, overlay, line, numText, titleText, subtitleText].forEach((e) => e.destroy());
  };
}
