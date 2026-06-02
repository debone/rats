import { animate } from 'animejs';
import { createTimeline } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ASSETS } from '@/assets';
import { defineSequence } from '@/core/vfx/types';
import type { SequenceContext } from '@/core/vfx/types';

/**
 * CUTSCENE: Boss Warning  [sequence]
 *
 * Three red flash bursts, WARNING blinks in, boss portrait slams in.
 * VFX type: defineSequence — complete choreographed moment with clear start/end.
 */

const bossWarningSequence = defineSequence<{ w: number; h: number }>({
  kind: 'sequence',
  id: 'bossWarning',
  async build({ w, h }, { layer }) {
    const flash = new Graphics();
    flash.rect(0, 0, w, h).fill(0xff1111);
    flash.alpha = 0;
    layer.addChild(flash);

    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(0x0a0009);
    bg.alpha = 0;
    layer.addChild(bg);

    const scanlines = new Graphics();
    layer.addChild(scanlines);
    let scanOffset = 0;
    let scanVisible = false;

    const tick = () => {
      if (!scanVisible) return;
      scanOffset = (scanOffset + 0.8) % 8;
      scanlines.clear();
      for (let y = scanOffset; y < h; y += 8) {
        scanlines.rect(0, y, w, 2).fill({ color: 0xff0000, alpha: 0.07 });
      }
    };
    app.ticker.add(tick);

    const warnText = new Text({
      text: '⚠  WARNING  ⚠',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 13, letterSpacing: 4, fill: 0xff2222, fontWeight: 'bold' },
    });
    warnText.anchor.set(0.5);
    warnText.x = w / 2;
    warnText.y = 22;
    warnText.alpha = 0;
    layer.addChild(warnText);

    const FW = 64;
    const FH = 64;
    const frame = new Graphics();
    frame
      .roundRect(w / 2 - FW / 2, h / 2 - FH / 2 - 8, FW, FH, 4)
      .fill(0x110011)
      .stroke({ color: 0xff2222, width: 2 });
    frame.alpha = 0;
    layer.addChild(frame);

    const bossSprite = new Sprite(Assets.get(ASSETS.prototype).textures['avatars_tile_3#0']);
    bossSprite.anchor.set(0.5);
    bossSprite.width = 52;
    bossSprite.height = 52;
    bossSprite.x = w / 2;
    bossSprite.y = h / 2 - 8;
    bossSprite.tint = 0xff5555;
    bossSprite.alpha = 0;
    layer.addChild(bossSprite);

    const bossName = new Text({
      text: 'THE RATFATHER',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, letterSpacing: 3, fill: 0xff4444, fontWeight: 'bold' },
    });
    bossName.anchor.set(0.5);
    bossName.x = w / 2;
    bossName.y = h / 2 + 42;
    bossName.alpha = 0;
    layer.addChild(bossName);

    const bossTitle = new Text({
      text: 'F I N A L  B O S S',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x882222 },
    });
    bossTitle.anchor.set(0.5);
    bossTitle.x = w / 2;
    bossTitle.y = h / 2 + 56;
    bossTitle.alpha = 0;
    layer.addChild(bossTitle);

    // Three red flashes
    for (let i = 0; i < 3; i++) {
      await animate(flash, { alpha: [0, 0.55, 0], duration: 180 });
      await new Promise<void>((res) => setTimeout(res, 70));
    }

    await animate(bg, { alpha: 0.9, duration: 300 });

    scanVisible = true;

    // WARNING blinks in fast
    for (let i = 0; i < 4; i++) {
      warnText.alpha = 1;
      await new Promise<void>((res) => setTimeout(res, 100));
      warnText.alpha = 0;
      await new Promise<void>((res) => setTimeout(res, 60));
    }
    warnText.alpha = 1;

    // Boss slams in
    await Promise.all([
      animate(frame, { alpha: 1, scaleX: [0, 1], scaleY: [0, 1], duration: 400, ease: 'outBack(1.5)' }),
      animate(bossSprite, { alpha: 1, scaleX: [0, 1], scaleY: [0, 1], duration: 380, delay: 80, ease: 'outBack(2.5)' }),
    ]);

    await animate(bossName, { alpha: 1, duration: 300 });
    await animate(bossTitle, { alpha: 1, duration: 250 });

    // Warning pulses
    const pulseAnim = animate(warnText, { alpha: [1, 0.2, 1], duration: 700, loop: true });

    await new Promise<void>((res) => setTimeout(res, 2400));
    pulseAnim.cancel();

    scanVisible = false;
    scanlines.clear();

    await Promise.all([
      animate(bg, { alpha: 0, duration: 400 }),
      animate(warnText, { alpha: 0, duration: 300 }),
      animate(frame, { alpha: 0, scaleX: 0, scaleY: 0, duration: 350, ease: 'inBack(2)' }),
      animate(bossSprite, { alpha: 0, scaleX: 0, scaleY: 0, duration: 300, ease: 'inBack(2)' }),
      animate(bossName, { alpha: 0, duration: 300 }),
      animate(bossTitle, { alpha: 0, duration: 300 }),
    ]);

    // Cleanup
    app.ticker.remove(tick);
    [flash, bg, scanlines, warnText, frame, bossSprite, bossName, bossTitle].forEach((e) => e.destroy());
  },
});

export function bossWarning(root: Container, w: number, h: number): () => void {
  let cancelled = false;

  const ctx: SequenceContext = {
    camera: null as any,
    layer: root,
    stage: root,
    size: { width: w, height: h },
    cutscene: () => Promise.resolve(),
    timeline: () => createTimeline(),
  };

  const loop = async () => {
    while (!cancelled) {
      await bossWarningSequence.build({ w, h }, ctx);
      await new Promise<void>((res) => setTimeout(res, 700));
    }
  };
  loop();

  return () => {
    cancelled = true;
  };
}
