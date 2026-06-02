/**
 * SHADER: Blur Pulse (Focus/Defocus)  [sequence]
 *
 * Animates BlurFilter.strength via animejs: 0→12 (blur) hold→0 (focus) loop.
 * VFX type: defineSequence — each blur cycle is a timed animation loop.
 */
import { animate } from 'animejs';
import { Assets, BlurFilter, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

const blurPulseSequence = defineSequence<{ blur: BlurFilter; label: Text }>({
  kind: 'sequence',
  id: 'blurPulse',
  async build({ blur, label }, _ctx: SequenceContext) {
    const proxy = { strength: 0 };

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

    await new Promise<void>((res) => setTimeout(res, 400));

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

    await new Promise<void>((res) => setTimeout(res, 900));
  },
});

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

  let cancelled = false;

  const play = async () => {
    while (!cancelled) {
      await blurPulseSequence.build({ blur, label }, {} as SequenceContext);
    }
  };

  play().catch(() => {});

  return () => {
    cancelled = true;
    root.filters = [];
    blur.destroy();
    bg.destroy();
    icon.destroy();
    label.destroy();
  };
}
