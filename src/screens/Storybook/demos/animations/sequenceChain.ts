import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const COLORS = [0xff4444, 0xff8800, 0xffee22, 0x44ff88, 0x4488ff];
const LABELS = ['A', 'B', 'C', 'D', 'E'];

export function sequenceChain(root: Container, w: number, h: number): () => void {
  const SIZE = 36;
  const spacing = (w - SIZE) / (COLORS.length - 1);

  const boxes: Graphics[] = [];
  const texts: Text[] = [];

  COLORS.forEach((color, i) => {
    const g = new Graphics();
    g.roundRect(0, 0, SIZE, SIZE, 6).fill(color);
    g.x = i * spacing;
    g.y = h / 2 - SIZE / 2;
    g.alpha = 0.15;
    root.addChild(g);
    boxes.push(g);

    const t = new Text({
      text: LABELS[i],
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 16, fontWeight: 'bold' },
    });
    t.anchor.set(0.5);
    t.x = i * spacing + SIZE / 2;
    t.y = h / 2;
    root.addChild(t);
    texts.push(t);
  });

  // Connector lines drawn between boxes
  const line = new Graphics();
  root.addChildAt(line, 0);

  const drawLines = () => {
    line.clear();
    for (let i = 0; i < boxes.length - 1; i++) {
      const x1 = boxes[i].x + SIZE;
      const x2 = boxes[i + 1].x;
      const y = h / 2;
      line.moveTo(x1, y).lineTo(x2, y).stroke({ color: 0x332255, width: 2 });
    }
  };
  drawLines();

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const play = async () => {
    if (cancelled) return;

    // Reset
    boxes.forEach((b) => { b.alpha = 0.15; b.y = h / 2 - SIZE / 2; });

    for (let i = 0; i < boxes.length; i++) {
      if (cancelled) return;

      await animate(boxes[i], {
        alpha: 1,
        y: h / 2 - SIZE / 2 - 16,
        duration: 220,
        ease: 'outBack(2)',
      });

      await animate(boxes[i], {
        y: h / 2 - SIZE / 2,
        duration: 150,
        ease: 'inSine',
      });

      if (i < boxes.length - 1) {
        await new Promise<void>((res) => { timer = setTimeout(res, 100); });
      }
    }

    if (cancelled) return;
    await new Promise<void>((res) => { timer = setTimeout(res, 800); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    boxes.forEach((b) => b.destroy());
    texts.forEach((t) => t.destroy());
    line.destroy();
  };
}
