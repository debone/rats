import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

export function safecrack(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dialPulse: ReturnType<typeof animate> | null = null;

  const cx = w / 2;
  const cy = h / 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x050508);
  bg.alpha = 0;
  root.addChild(bg);

  // Vault door frame
  const doorFrame = new Graphics();
  doorFrame
    .roundRect(cx - 42, cy - 46, 84, 92, 4)
    .fill(0x1a1818)
    .stroke({ color: 0x3a3028, width: 2 });
  doorFrame.alpha = 0;
  root.addChild(doorFrame);

  // Door panels — left and right half (split open at end)
  const doorLeft = new Graphics();
  doorLeft
    .rect(cx - 42, cy - 46, 42, 92)
    .fill(0x2a2420)
    .stroke({ color: 0x3a3028, width: 1 });
  // Rivets on left panel
  for (let ry = cy - 36; ry < cy + 46; ry += 20) {
    doorLeft
      .circle(cx - 32, ry, 2)
      .fill(0x4a4038);
    doorLeft
      .circle(cx - 14, ry, 2)
      .fill(0x4a4038);
  }
  doorLeft.alpha = 0;
  root.addChild(doorLeft);

  const doorRight = new Graphics();
  doorRight
    .rect(cx, cy - 46, 42, 92)
    .fill(0x2a2420)
    .stroke({ color: 0x3a3028, width: 1 });
  for (let ry = cy - 36; ry < cy + 46; ry += 20) {
    doorRight
      .circle(cx + 14, ry, 2)
      .fill(0x4a4038);
    doorRight
      .circle(cx + 32, ry, 2)
      .fill(0x4a4038);
  }
  doorRight.alpha = 0;
  root.addChild(doorRight);

  // Dial container (rotates)
  const dialContainer = new Container();
  dialContainer.x = cx;
  dialContainer.y = cy - 10;
  dialContainer.alpha = 0;
  root.addChild(dialContainer);

  // Dial body
  const dialBody = new Graphics();
  dialBody
    .circle(0, 0, 18)
    .fill(0x1a1818)
    .stroke({ color: 0x6a5a40, width: 2 });
  dialBody
    .circle(0, 0, 3)
    .fill(0x4a4030);
  dialContainer.addChild(dialBody);

  // Tick marks on dial
  const NUM_TICKS = 12;
  for (let t = 0; t < NUM_TICKS; t++) {
    const ang = (t / NUM_TICKS) * Math.PI * 2;
    const inner = t % 3 === 0 ? 13 : 15;
    const outer = 17;
    const tickLine = new Graphics();
    tickLine
      .moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner)
      .lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer)
      .stroke({ color: t % 3 === 0 ? 0x8a7a50 : 0x4a4030, width: t % 3 === 0 ? 1.5 : 1 });
    dialContainer.addChild(tickLine);
  }

  // Dial indicator line (points to current position)
  const dialIndicator = new Graphics();
  dialIndicator
    .moveTo(0, 0)
    .lineTo(0, -14)
    .stroke({ color: 0xaa8840, width: 2 });
  dialContainer.addChild(dialIndicator);

  // Combination display — 4 digits
  const COMBO = ['7', '3', '1', '9'];
  const comboTexts: Text[] = COMBO.map((digit, i) => {
    const t = new Text({
      text: digit,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: 0x6a8a5a, fontWeight: 'bold' },
    });
    t.anchor.set(0.5);
    t.x = cx - 22 + i * 15;
    t.y = cy + 32;
    t.alpha = 0;
    root.addChild(t);
    return t;
  });

  // Status text
  const statusText = new Text({
    text: 'CRACKING...',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x4a6a3a },
  });
  statusText.anchor.set(0.5);
  statusText.x = cx;
  statusText.y = cy + 48;
  statusText.alpha = 0;
  root.addChild(statusText);

  const unlockedText = new Text({
    text: '✓  UNLOCKED',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 3, fill: 0x6aaa6a, fontWeight: 'bold' },
  });
  unlockedText.anchor.set(0.5);
  unlockedText.x = cx;
  unlockedText.y = cy;
  unlockedText.alpha = 0;
  root.addChild(unlockedText);

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    doorFrame.alpha = 0;
    doorLeft.alpha = 0;
    doorLeft.x = 0;
    doorRight.alpha = 0;
    doorRight.x = 0;
    dialContainer.alpha = 0;
    dialContainer.rotation = 0;
    comboTexts.forEach((t) => {
      t.alpha = 0;
    });
    statusText.alpha = 0;
    unlockedText.alpha = 0;
    dialPulse?.cancel();

    await animate(bg, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await Promise.all([
      animate(doorFrame, { alpha: 1, duration: 350 }),
      animate(doorLeft, { alpha: 1, duration: 300 }),
      animate(doorRight, { alpha: 1, duration: 300 }),
    ]);
    if (cancelled) return;

    await animate(dialContainer, { alpha: 1, duration: 300 });
    if (cancelled) return;

    await animate(statusText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    // Crack the combination — 4 phases, dial spins then a digit clicks in
    for (let i = 0; i < COMBO.length; i++) {
      if (cancelled) return;

      // Dial spins fast, slows to click
      const spinDir = i % 2 === 0 ? 1 : -1;
      await animate(dialContainer, {
        rotation: dialContainer.rotation + spinDir * Math.PI * 2.5,
        duration: 600,
        ease: 'outQuad',
      });
      if (cancelled) return;

      // Digit appears with a small bounce
      await animate(comboTexts[i], {
        alpha: 1,
        scaleX: [1.4, 1],
        scaleY: [1.4, 1],
        duration: 180,
        ease: 'outBack(2)',
      });
      if (cancelled) return;

      await new Promise<void>((res) => {
        timer = setTimeout(res, 140);
      });
    }
    if (cancelled) return;

    // Final click — halt
    await animate(dialContainer, {
      rotation: dialContainer.rotation + 0.15,
      duration: 120,
      ease: 'outBounce',
    });
    if (cancelled) return;

    statusText.text = 'ACCEPTED';
    dialPulse = animate(statusText, { alpha: [1, 0.4, 1], duration: 500, loop: true });

    await new Promise<void>((res) => {
      timer = setTimeout(res, 500);
    });
    if (cancelled) return;

    dialPulse.cancel();

    // Doors split open
    await Promise.all([
      animate(dialContainer, { alpha: 0, duration: 300 }),
      animate(doorLeft, { x: -38, alpha: 0, duration: 550, ease: 'inBack(1.2)' }),
      animate(doorRight, { x: 38, alpha: 0, duration: 550, ease: 'inBack(1.2)' }),
      animate(statusText, { alpha: 0, duration: 300 }),
    ]);
    if (cancelled) return;

    await animate(unlockedText, { alpha: 1, scaleX: [0.6, 1], scaleY: [0.6, 1], duration: 350, ease: 'outBack' });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 1800);
    });
    if (cancelled) return;

    await Promise.all([
      animate(bg, { alpha: 0, duration: 500 }),
      animate(doorFrame, { alpha: 0, duration: 400 }),
      animate(unlockedText, { alpha: 0, duration: 400 }),
      ...comboTexts.map((t) => animate(t, { alpha: 0, duration: 300 })),
    ]);
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
    dialPulse?.cancel();
    [bg, doorFrame, doorLeft, doorRight, dialContainer, statusText, unlockedText, ...comboTexts].forEach((e) =>
      e.destroy(),
    );
  };
}
