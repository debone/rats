import { animate } from 'animejs';
import { Assets, Container, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { ASSETS } from '@/assets';

export function counterTick(root: Container, w: number, h: number): () => void {
  const cheeseTexture = Assets.get(ASSETS.prototype).textures['cheese_tile_1#0'];

  const proxy = { value: 0 };
  let target = 0;

  const label = new Text({
    text: '0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 48, fontWeight: 'bold', fill: 0xffee44 },
  });
  label.anchor.set(0.5);
  label.x = w / 2;
  label.y = h / 2 - 30;
  root.addChild(label);

  const sub = new Text({
    text: 'CHEESE',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, letterSpacing: 3, fill: 0x886633 },
  });
  sub.anchor.set(0.5);
  sub.x = w / 2;
  sub.y = h / 2 + 30;
  root.addChild(sub);

  // Cheese icon beside number
  const icon = new Sprite(cheeseTexture);
  icon.anchor.set(0.5);
  icon.x = w / 2 - 60;
  icon.y = h / 2 - 30;
  icon.scale.set(1.5);
  root.addChild(icon);

  let anim: ReturnType<typeof animate> | null = null;

  const tick = (n: number) => {
    anim?.cancel();
    target = n;
    anim = animate(proxy, {
      value: target,
      duration: 800,
      ease: 'outQuad',
      onUpdate: () => {
        label.text = Math.round(proxy.value).toString();
      },
    });
    animate(label.scale, { x: [1.4, 1], y: [1.4, 1], duration: 250, ease: 'outBack(2)' });
    animate(icon, { rotation: icon.rotation + 0.4, duration: 200 });
  };

  const makeButton = (txt: string, amount: number, color: number) => {
    const bg = new LayoutContainer({
      layout: {
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: 0x1a1a2e,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
        alignItems: 'center',
      },
    });
    bg.addChild(new Text({ text: txt, style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, fill: color }, layout: true }));
    const btn = new Button(bg);
    btn.onHover.connect(() => {
      bg.background.tint = color;
    });
    btn.onOut.connect(() => {
      bg.background.tint = 0xffffff;
    });
    btn.onPress.connect(() => {
      tick(Math.max(0, proxy.value + amount));
    });
    return btn.view!;
  };

  const plusBtn = makeButton('+5', 5, 0xffee44);
  const minusBtn = makeButton('−3', -3, 0xff6644);
  const resetBtn = makeButton('↺', -proxy.value, 0x9944bb);

  plusBtn.x = w / 2 - 90;
  plusBtn.y = h - 80;
  minusBtn.x = w / 2 - 20;
  minusBtn.y = h - 80;
  resetBtn.x = w / 2 + 50;
  resetBtn.y = h - 80;

  root.addChild(plusBtn, minusBtn, resetBtn);

  return () => {
    anim?.cancel();
    label.destroy();
    sub.destroy();
    icon.destroy();
    plusBtn.destroy({ children: true });
    minusBtn.destroy({ children: true });
    resetBtn.destroy({ children: true });
  };
}
