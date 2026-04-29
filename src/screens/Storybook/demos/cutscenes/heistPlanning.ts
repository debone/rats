import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

export function heistPlanning(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cx = w / 2;
  const cy = h / 2;

  // Cork board background
  const board = new Graphics();
  board
    .rect(0, 0, w, h)
    .fill(0x5a3e20);
  for (let y = 0; y < h; y += 3) {
    board
      .rect(0, y, w, 1)
      .fill({ color: y % 6 === 0 ? 0x4a3018 : 0x6a4828, alpha: 0.3 });
  }
  board.alpha = 0;
  root.addChild(board);

  const titlePin = new Graphics();
  titlePin
    .circle(cx, 10, 3)
    .fill(0xcc3322);
  titlePin.alpha = 0;
  root.addChild(titlePin);

  const titleText = new Text({
    text: 'THE PLAN',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 4, fill: 0x1a1008, fontWeight: 'bold' },
  });
  titleText.anchor.set(0.5);
  titleText.x = cx;
  titleText.y = 16;
  titleText.alpha = 0;
  root.addChild(titleText);

  // Cards — sticky notes on the board
  const CARD_DATA = [
    { label: 'ENTRY\nPIPE B', x: cx - 50, y: cy - 20, rot: -0.08 },
    { label: 'GUARD\nSCHED.', x: cx + 10, y: cy - 28, rot: 0.06 },
    { label: 'VAULT\nLOC.', x: cx - 20, y: cy + 20, rot: -0.04 },
    { label: 'ESCAPE\nROUTE', x: cx + 44, y: cy + 14, rot: 0.1 },
  ];

  const cardContainers: Container[] = CARD_DATA.map((data) => {
    const container = new Container();
    container.x = data.x;
    container.y = data.y;
    container.rotation = data.rot;
    container.alpha = 0;
    root.addChild(container);

    const bg = new Graphics();
    bg
      .rect(-20, -14, 40, 28)
      .fill(0xe8dfc0)
      .stroke({ color: 0xc0b090, width: 1 });
    container.addChild(bg);

    const tape = new Graphics();
    tape
      .rect(-8, -18, 16, 7)
      .fill({ color: 0xd0c890, alpha: 0.7 });
    container.addChild(tape);

    const text = new Text({
      text: data.label,
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: 5,
        fill: 0x2a1808,
        wordWrap: true,
        wordWrapWidth: 36,
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    text.y = 2;
    container.addChild(text);

    return container;
  });

  // Connecting strings drawn between card positions
  const strings = new Graphics();
  root.addChild(strings);

  // Push pins on cards
  const pins: Graphics[] = CARD_DATA.map((data) => {
    const pin = new Graphics();
    pin
      .circle(data.x, data.y - 14, 2.5)
      .fill(0xcc3322);
    pin.alpha = 0;
    root.addChild(pin);
    return pin;
  });

  const notesText = new Text({
    text: 'in. out. no traces.',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x3a2810, letterSpacing: 2 },
  });
  notesText.anchor.set(0.5);
  notesText.x = cx;
  notesText.y = h - 14;
  notesText.alpha = 0;
  root.addChild(notesText);

  const drawStrings = (count: number) => {
    strings.clear();
    for (let i = 0; i < count && i < CARD_DATA.length - 1; i++) {
      const from = CARD_DATA[i];
      const to = CARD_DATA[i + 1];
      strings
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ color: 0xcc4422, width: 1, alpha: 0.7 });
    }
    if (count >= CARD_DATA.length) {
      const last = CARD_DATA[CARD_DATA.length - 1];
      const first = CARD_DATA[0];
      strings
        .moveTo(last.x, last.y)
        .lineTo(first.x, first.y)
        .stroke({ color: 0xcc4422, width: 1, alpha: 0.5 });
    }
  };

  const play = async () => {
    if (cancelled) return;

    board.alpha = 0;
    titlePin.alpha = 0;
    titleText.alpha = 0;
    strings.clear();
    notesText.alpha = 0;
    cardContainers.forEach((c) => {
      c.alpha = 0;
    });
    pins.forEach((p) => {
      p.alpha = 0;
    });

    await animate(board, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await Promise.all([
      animate(titlePin, { alpha: 1, duration: 300 }),
      animate(titleText, { alpha: 1, duration: 400 }),
    ]);
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 300);
    });
    if (cancelled) return;

    // Cards slap onto board one by one
    for (let i = 0; i < cardContainers.length; i++) {
      if (cancelled) return;

      await animate(cardContainers[i], {
        alpha: 1,
        scaleX: [0.6, 1],
        scaleY: [0.6, 1],
        duration: 200,
        ease: 'outBack(2)',
      });

      await animate(pins[i], { alpha: 1, duration: 150 });

      drawStrings(i + 1);

      await new Promise<void>((res) => {
        timer = setTimeout(res, 200);
      });
    }
    if (cancelled) return;

    await animate(notesText, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2400);
    });
    if (cancelled) return;

    await Promise.all([
      animate(board, { alpha: 0, duration: 600 }),
      animate(titleText, { alpha: 0, duration: 400 }),
      animate(titlePin, { alpha: 0, duration: 400 }),
      animate(notesText, { alpha: 0, duration: 400 }),
      ...cardContainers.map((c) => animate(c, { alpha: 0, duration: 350 })),
      ...pins.map((p) => animate(p, { alpha: 0, duration: 300 })),
    ]);
    strings.clear();
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
    [board, titlePin, titleText, strings, notesText, ...pins, ...cardContainers].forEach((e) => e.destroy());
  };
}
