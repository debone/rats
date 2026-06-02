import { signal, computed } from '@/core/reactivity/signals/signals';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';

export function reactiveText(root: Container, w: number, h: number): () => void {
  const count = signal(0);
  const doubled = computed(() => count.get() * 2);
  const parity = computed(() => (count.get() % 2 === 0 ? 'EVEN' : 'ODD'));
  const color = computed(() => (count.get() % 2 === 0 ? 0x44ffcc : 0xff6644));

  const bg = new Graphics();
  bg.roundRect(w / 2 - 110, h / 2 - 90, 220, 180, 10).fill(0x0f0f1e);
  bg.roundRect(w / 2 - 110, h / 2 - 90, 220, 180, 10).stroke({ color: 0x221133, width: 1 });
  root.addChild(bg);

  const countLabel = new Text({
    text: 'COUNT: 0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 20, fontWeight: 'bold' },
  });
  countLabel.anchor.set(0.5);
  countLabel.x = w / 2;
  countLabel.y = h / 2 - 52;
  root.addChild(countLabel);

  const doubledLabel = new Text({
    text: 'DOUBLED: 0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, fill: 0x8866aa },
  });
  doubledLabel.anchor.set(0.5);
  doubledLabel.x = w / 2;
  doubledLabel.y = h / 2 - 20;
  root.addChild(doubledLabel);

  const parityLabel = new Text({
    text: 'EVEN',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 3, fill: 0x44ffcc },
  });
  parityLabel.anchor.set(0.5);
  parityLabel.x = w / 2;
  parityLabel.y = h / 2 + 14;
  root.addChild(parityLabel);

  const hint = new Text({
    text: 'signals auto-update derived values',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x443355 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 20;
  root.addChild(hint);

  // Wire signals → UI
  const unsub1 = count.subscribe((v) => { countLabel.text = `COUNT: ${v}`; });
  const unsub2 = doubled.subscribe((v) => { doubledLabel.text = `DOUBLED: ${v}`; });
  const unsub3 = parity.subscribe((v) => { parityLabel.text = v; });
  const unsub4 = color.subscribe((v) => { parityLabel.style.fill = v; });

  const makeBtn = (label: string, action: () => void, color: number, x: number) => {
    const bg = new LayoutContainer({
      layout: {
        width: 80, paddingTop: 10, paddingBottom: 10,
        backgroundColor: 0x111122, borderColor: color, borderWidth: 1, borderRadius: 4,
        alignItems: 'center', justifyContent: 'center',
      },
    });
    bg.addChild(new Text({ text: label, style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, fill: color }, layout: true }));
    const btn = new Button(bg);
    btn.view!.x = x;
    btn.view!.y = h / 2 + 52;
    btn.onHover.connect(() => { bg.background.tint = color; });
    btn.onOut.connect(() => { bg.background.tint = 0xffffff; });
    btn.onPress.connect(action);
    root.addChild(btn.view!);
    return btn.view!;
  };

  const plusBtn = makeBtn('+1', () => count.set(count.get() + 1), 0x44ffcc, w / 2 - 92);
  const minusBtn = makeBtn('−1', () => count.set(Math.max(0, count.get() - 1)), 0xff6644, w / 2 - 4);
  const resetBtn = makeBtn('↺', () => count.set(0), 0x9944bb, w / 2 + 84);

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    count.dispose();
    doubled.dispose();
    parity.dispose();
    color.dispose();
    bg.destroy();
    countLabel.destroy();
    doubledLabel.destroy();
    parityLabel.destroy();
    hint.destroy();
    plusBtn.destroy({ children: true });
    minusBtn.destroy({ children: true });
    resetBtn.destroy({ children: true });
  };
}
