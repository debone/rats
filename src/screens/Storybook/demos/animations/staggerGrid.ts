import { animate } from 'animejs';
import { Container, Graphics } from 'pixi.js';

export function staggerGrid(root: Container, w: number, h: number): () => void {
  const COLS = 6;
  const ROWS = 5;
  const SIZE = 28;
  const GAP = 8;
  const totalW = COLS * (SIZE + GAP) - GAP;
  const totalH = ROWS * (SIZE + GAP) - GAP;
  const startX = (w - totalW) / 2;
  const startY = (h - totalH) / 2;

  const boxes: Graphics[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const g = new Graphics();
      g.roundRect(0, 0, SIZE, SIZE, 5).fill(0x9944bb);
      g.x = startX + col * (SIZE + GAP);
      g.y = startY + row * (SIZE + GAP);
      g.alpha = 0;
      g.scale.set(0.1);
      root.addChild(g);
      boxes.push(g);
    }
  }

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const play = async () => {
    if (cancelled) return;

    // Pop in with stagger
    for (let i = 0; i < boxes.length; i++) {
      boxes[i].alpha = 0;
      boxes[i].scale.set(0.1);
    }

    const anims = boxes.map((box, i) =>
      animate(box, {
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        delay: i * 35,
        ease: 'outBack(1.4)',
      }),
    );

    await Promise.all(anims);
    if (cancelled) return;

    // Pulse wave
    await new Promise<void>((res) => { timer = setTimeout(res, 400); });
    if (cancelled) return;

    const wave = boxes.map((box, i) =>
      animate(box, {
        scaleX: [1, 1.25, 1],
        scaleY: [1, 1.25, 1],
        tint: [0x9944bb, 0xffaaff, 0x9944bb],
        duration: 500,
        delay: i * 25,
        ease: 'inOutSine',
      }),
    );
    await Promise.all(wave);
    if (cancelled) return;

    await new Promise<void>((res) => { timer = setTimeout(res, 600); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    boxes.forEach((b) => b.destroy());
  };
}
