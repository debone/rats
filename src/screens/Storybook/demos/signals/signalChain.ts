import { signal, computed, effect } from '@/core/reactivity/signals/signals';
import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';

export function signalChain(root: Container, w: number, h: number): () => void {
  // Chain: source → multiplied → formatted → displayed
  const source = signal(1);
  const multiplied = computed(() => source.get() * 7);
  const formatted = computed(() => `score: ${multiplied.get()}`);

  const NODE_Y = [h / 2 - 80, h / 2 - 20, h / 2 + 40, h / 2 + 100];
  const LABELS = ['source', '× 7 (computed)', 'formatted (computed)', 'UI effect'];
  const COLORS = [0x4488ff, 0x44ccff, 0x88ffcc, 0xffcc44];

  const nodeBoxes: Graphics[] = [];
  const nodeTexts: Text[] = [];

  NODE_Y.forEach((y, i) => {
    const box = new Graphics();
    box.roundRect(w / 2 - 90, y, 180, 26, 5).fill(0x111122).stroke({ color: COLORS[i], width: 1 });
    root.addChild(box);
    nodeBoxes.push(box);

    const txt = new Text({
      text: LABELS[i],
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: COLORS[i] },
    });
    txt.anchor.set(0.5);
    txt.x = w / 2;
    txt.y = y + 13;
    root.addChild(txt);
    nodeTexts.push(txt);

    // Arrow to next node
    if (i < NODE_Y.length - 1) {
      const arrow = new Graphics();
      arrow.moveTo(w / 2, y + 26).lineTo(w / 2, NODE_Y[i + 1]).stroke({ color: 0x332255, width: 1 });
      arrow.moveTo(w / 2 - 4, NODE_Y[i + 1] - 6).lineTo(w / 2, NODE_Y[i + 1]).lineTo(w / 2 + 4, NODE_Y[i + 1] - 6).stroke({ color: 0x332255, width: 1 });
      root.addChild(arrow);
    }
  });

  // Effect: when formatted changes, pulse the last node
  const cleanup = effect(() => {
    const val = formatted.get();
    nodeTexts[2].text = val;
    nodeTexts[3].text = `"${val}"`;
    animate(nodeBoxes[3], { alpha: [0.3, 1], scaleX: [0.95, 1], scaleY: [0.95, 1], duration: 200, ease: 'outBack' });
    animate(nodeBoxes[2], { alpha: [0.3, 1], duration: 150, delay: 0 });
    animate(nodeBoxes[1], { alpha: [0.3, 1], duration: 150, delay: 0 });
  });

  // Source value display
  const sourceValText = new Text({
    text: '1',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 20, fontWeight: 'bold', fill: 0x4488ff },
  });
  sourceValText.anchor.set(0.5);
  sourceValText.x = w / 2 + 110;
  sourceValText.y = NODE_Y[0] + 13;
  root.addChild(sourceValText);

  const unsub = source.subscribe((v) => {
    nodeTexts[0].text = `source = ${v}`;
    sourceValText.text = String(v);
  });

  // Buttons
  const makeSideBtn = (label: string, action: () => void, color: number, x: number) => {
    const bg = new LayoutContainer({
      layout: {
        width: 60, paddingTop: 8, paddingBottom: 8,
        backgroundColor: 0x0d0d1e, borderColor: color, borderWidth: 1, borderRadius: 4,
        alignItems: 'center', justifyContent: 'center',
      },
    });
    bg.addChild(new Text({ text: label, style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, fill: color }, layout: true }));
    const btn = new Button(bg);
    btn.view!.x = x;
    btn.view!.y = h - 60;
    btn.onHover.connect(() => { bg.background.tint = color; });
    btn.onOut.connect(() => { bg.background.tint = 0xffffff; });
    btn.onPress.connect(action);
    root.addChild(btn.view!);
    return btn.view!;
  };

  const plusBtn = makeSideBtn('+1', () => source.set(source.get() + 1), 0x44ccff, w / 2 - 70);
  const minusBtn = makeSideBtn('−1', () => source.set(Math.max(0, source.get() - 1)), 0xff6644, w / 2 + 10);

  return () => {
    cleanup?.();
    unsub();
    source.dispose();
    multiplied.dispose();
    formatted.dispose();
    nodeBoxes.forEach((b) => b.destroy());
    nodeTexts.forEach((t) => t.destroy());
    sourceValText.destroy();
    plusBtn.destroy({ children: true });
    minusBtn.destroy({ children: true });
  };
}
