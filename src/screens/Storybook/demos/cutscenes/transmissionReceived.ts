import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';

const MESSAGES = [
  {
    from: 'RAT-7 // NEON',
    signal: '██ ██ ██',
    lines: [
      'Tunnel C is clear.',
      'Guard rotation confirmed: 90s.',
      'Move on my signal.',
    ],
    color: 0x44ccff,
  },
  {
    from: 'RATFATHER // HQ',
    signal: '████████',
    lines: [
      'The vault has three locks.',
      'You have exactly one chance.',
      'Do not waste it.',
    ],
    color: 0xcc8844,
  },
];

export function transmissionReceived(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let msgIndex = 0;

  // Scan line noise (ticker-driven)
  const noise = new Graphics();
  root.addChild(noise);
  let noiseVisible = false;
  let noiseFrame = 0;

  const noiseTick = () => {
    if (!noiseVisible) return;
    noiseFrame++;
    if (noiseFrame % 3 !== 0) return;
    noise.clear();
    for (let i = 0; i < 6; i++) {
      const ny = Math.random() * h;
      const nw = 10 + Math.random() * 30;
      const nx = Math.random() * (w - nw);
      noise
        .rect(nx, ny, nw, 1 + Math.random() * 2)
        .fill({ color: 0x44ccff, alpha: 0.08 + Math.random() * 0.12 });
    }
  };
  app.ticker.add(noiseTick);

  // Terminal frame
  const PW = w - 20;
  const PH = 130;
  const PX = 10;
  const PY = (h - PH) / 2;

  const frame = new Graphics();
  frame
    .roundRect(PX, PY, PW, PH, 4)
    .fill(0x030810)
    .stroke({ color: 0x224455, width: 1 });
  frame.alpha = 0;
  root.addChild(frame);

  // Top bar
  const topBar = new Graphics();
  topBar
    .roundRect(PX, PY, PW, 18, { tl: 4, tr: 4, bl: 0, br: 0 })
    .fill(0x0a1a28);
  topBar.alpha = 0;
  root.addChild(topBar);

  const incomingText = new Text({
    text: '▶ INCOMING TRANSMISSION',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 2, fill: 0x44ccff },
  });
  incomingText.x = PX + 8;
  incomingText.y = PY + 5;
  incomingText.alpha = 0;
  root.addChild(incomingText);

  // Signal bars
  const signalBars = new Graphics();
  root.addChild(signalBars);

  const fromText = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 2, fill: 0x558899 },
  });
  fromText.x = PX + 10;
  fromText.y = PY + 26;
  fromText.alpha = 0;
  root.addChild(fromText);

  const divLine = new Graphics();
  root.addChild(divLine);

  // Message lines (up to 3)
  const msgLines: Text[] = [];
  for (let i = 0; i < 3; i++) {
    const t = new Text({
      text: '',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x88ccaa },
    });
    t.x = PX + 10;
    t.y = PY + 46 + i * 20;
    t.alpha = 0;
    root.addChild(t);
    msgLines.push(t);
  }

  const endText = new Text({
    text: '— TRANSMISSION ENDED —',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x224455 },
  });
  endText.anchor.set(0.5);
  endText.x = w / 2;
  endText.y = PY + PH - 10;
  endText.alpha = 0;
  root.addChild(endText);

  const drawSignal = (bars: number, color: number) => {
    signalBars.clear();
    for (let i = 0; i < 4; i++) {
      const bh = 3 + i * 3;
      const filled = i < bars;
      signalBars
        .rect(PX + PW - 28 + i * 7, PY + 8 - bh, 5, bh)
        .fill({ color, alpha: filled ? 0.9 : 0.2 });
    }
  };

  const typewriteLine = async (textObj: Text, full: string) => {
    textObj.text = '';
    const proxy = { n: 0 };
    await animate(proxy, {
      n: full.length,
      duration: full.length * 38,
      ease: 'linear',
      onUpdate: () => {
        textObj.text = full.slice(0, Math.floor(proxy.n));
      },
    });
  };

  const play = async () => {
    if (cancelled) return;

    const msg = MESSAGES[msgIndex % MESSAGES.length];
    msgIndex++;

    // Reset
    frame.alpha = 0;
    topBar.alpha = 0;
    incomingText.alpha = 0;
    fromText.alpha = 0;
    divLine.clear();
    signalBars.clear();
    msgLines.forEach((l) => {
      l.alpha = 0;
      l.text = '';
    });
    endText.alpha = 0;
    noiseVisible = false;
    noise.clear();

    // Frame appears
    await Promise.all([
      animate(frame, { alpha: 1, duration: 300 }),
      animate(topBar, { alpha: 1, duration: 300 }),
    ]);
    if (cancelled) return;

    noiseVisible = true;

    // INCOMING blinks in
    for (let i = 0; i < 3; i++) {
      incomingText.alpha = 1;
      await new Promise<void>((res) => {
        timer = setTimeout(res, 90);
      });
      if (cancelled) return;
      incomingText.alpha = 0;
      await new Promise<void>((res) => {
        timer = setTimeout(res, 60);
      });
      if (cancelled) return;
    }
    incomingText.alpha = 1;

    // Signal bars fill up one at a time
    for (let b = 1; b <= 4; b++) {
      drawSignal(b, msg.color);
      await new Promise<void>((res) => {
        timer = setTimeout(res, 140);
      });
      if (cancelled) return;
    }

    // FROM line
    fromText.text = `FROM: ${msg.from}`;
    fromText.style.fill = msg.color;
    await animate(fromText, { alpha: 1, duration: 220 });
    if (cancelled) return;

    // Divider grows
    const lp = { w: 0 };
    await animate(lp, {
      w: PW - 20,
      duration: 280,
      ease: 'outQuad',
      onUpdate: () => {
        divLine
          .clear()
          .rect(PX + 10, PY + 38, lp.w, 1)
          .fill({ color: msg.color, alpha: 0.3 });
      },
    });
    if (cancelled) return;

    // Type out each message line
    for (let i = 0; i < msg.lines.length; i++) {
      if (cancelled) return;
      msgLines[i].alpha = 1;
      await typewriteLine(msgLines[i], msg.lines[i]);
      await new Promise<void>((res) => {
        timer = setTimeout(res, 200);
      });
    }
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (cancelled) return;

    // TRANSMISSION ENDED
    await animate(endText, { alpha: 1, duration: 300 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 1200);
    });
    if (cancelled) return;

    noiseVisible = false;
    noise.clear();

    await Promise.all([
      animate(frame, { alpha: 0, duration: 350 }),
      animate(topBar, { alpha: 0, duration: 350 }),
      animate(incomingText, { alpha: 0, duration: 280 }),
      animate(fromText, { alpha: 0, duration: 280 }),
      animate(endText, { alpha: 0, duration: 280 }),
      ...msgLines.map((l) => animate(l, { alpha: 0, duration: 260 })),
    ]);
    divLine.clear();
    signalBars.clear();
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
    app.ticker.remove(noiseTick);
    [frame, topBar, incomingText, fromText, divLine, signalBars, endText, noise, ...msgLines].forEach((e) => e.destroy());
  };
}
