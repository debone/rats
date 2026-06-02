import { animate } from 'animejs';
import { Assets, BlurFilter, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';

export function blurPulse(root: Container, w: number, h: number): () => void {
  const blur = new BlurFilter({ strength: 0, quality: 4 });

  const bg = new Graphics();
  bg.roundRect(w / 2 - 80, h / 2 - 100, 160, 160, 12).fill(0x1a0d2e);
  root.addChild(bg);

  const icon = new Sprite(Assets.get(ASSETS.prototype).textures['cheese_tile_1#0']);
  icon.anchor.set(0.5);
  icon.scale.set(3);
  icon.x = w / 2;
  icon.y = h / 2 - 20;
  root.addChild(icon);

  const label = new Text({
    text: 'FOCUS',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, letterSpacing: 4 },
  });
  label.anchor.set(0.5);
  label.x = w / 2;
  label.y = h / 2 + 60;
  root.addChild(label);

  root.filters = [blur];

  const proxy = { strength: 0 };
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const play = async () => {
    if (cancelled) return;

    // Blur in (unfocused)
    await animate(proxy, {
      strength: 12,
      duration: 700,
      ease: 'inSine',
      onUpdate: () => {
        blur.strength = proxy.strength;
        label.text = 'BLUR';
      },
    });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 400);
    });
    if (cancelled) return;

    // Blur out (focus)
    await animate(proxy, {
      strength: 0,
      duration: 500,
      ease: 'outSine',
      onUpdate: () => {
        blur.strength = proxy.strength;
        label.text = 'FOCUS';
      },
    });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 900);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    root.filters = [];
    blur.destroy();
    bg.destroy();
    icon.destroy();
    label.destroy();
  };
}
