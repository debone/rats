import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ASSETS } from '@/assets';

export function bossWarning(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flash = new Graphics();
  flash.rect(0, 0, w, h).fill(0xff1111);
  flash.alpha = 0;
  root.addChild(flash);

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x0a0009);
  bg.alpha = 0;
  root.addChild(bg);

  // Moving scanlines
  const scanlines = new Graphics();
  root.addChild(scanlines);
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
  root.addChild(warnText);

  const FW = 64;
  const FH = 64;
  const frame = new Graphics();
  frame
    .roundRect(w / 2 - FW / 2, h / 2 - FH / 2 - 8, FW, FH, 4)
    .fill(0x110011)
    .stroke({ color: 0xff2222, width: 2 });
  frame.alpha = 0;
  root.addChild(frame);

  const bossSprite = new Sprite(Assets.get(ASSETS.prototype).textures['avatars_tile_3#0']);
  bossSprite.anchor.set(0.5);
  bossSprite.width = 52;
  bossSprite.height = 52;
  bossSprite.x = w / 2;
  bossSprite.y = h / 2 - 8;
  bossSprite.tint = 0xff5555;
  bossSprite.alpha = 0;
  root.addChild(bossSprite);

  const bossName = new Text({
    text: 'THE RATFATHER',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, letterSpacing: 3, fill: 0xff4444, fontWeight: 'bold' },
  });
  bossName.anchor.set(0.5);
  bossName.x = w / 2;
  bossName.y = h / 2 + 42;
  bossName.alpha = 0;
  root.addChild(bossName);

  const bossTitle = new Text({
    text: 'F I N A L  B O S S',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x882222 },
  });
  bossTitle.anchor.set(0.5);
  bossTitle.x = w / 2;
  bossTitle.y = h / 2 + 56;
  bossTitle.alpha = 0;
  root.addChild(bossTitle);

  const play = async () => {
    if (cancelled) return;

    flash.alpha = 0;
    bg.alpha = 0;
    warnText.alpha = 0;
    frame.alpha = 0;
    frame.scale.set(0);
    bossSprite.alpha = 0;
    bossSprite.scale.set(0);
    bossName.alpha = 0;
    bossTitle.alpha = 0;
    scanVisible = false;
    scanlines.clear();

    // Three red flashes
    for (let i = 0; i < 3; i++) {
      await animate(flash, { alpha: [0, 0.55, 0], duration: 180 });
      if (cancelled) return;
      await new Promise<void>((res) => {
        timer = setTimeout(res, 70);
      });
      if (cancelled) return;
    }

    await animate(bg, { alpha: 0.9, duration: 300 });
    if (cancelled) return;

    scanVisible = true;

    // WARNING blinks in fast
    for (let i = 0; i < 4; i++) {
      warnText.alpha = 1;
      await new Promise<void>((res) => {
        timer = setTimeout(res, 100);
      });
      if (cancelled) return;
      warnText.alpha = 0;
      await new Promise<void>((res) => {
        timer = setTimeout(res, 60);
      });
      if (cancelled) return;
    }
    warnText.alpha = 1;

    // Boss slams in
    await Promise.all([
      animate(frame, { alpha: 1, scaleX: [0, 1], scaleY: [0, 1], duration: 400, ease: 'outBack(1.5)' }),
      animate(bossSprite, { alpha: 1, scaleX: [0, 1], scaleY: [0, 1], duration: 380, delay: 80, ease: 'outBack(2.5)' }),
    ]);
    if (cancelled) return;

    await animate(bossName, { alpha: 1, duration: 300 });
    if (cancelled) return;
    await animate(bossTitle, { alpha: 1, duration: 250 });
    if (cancelled) return;

    // Warning pulses
    const pulseAnim = animate(warnText, { alpha: [1, 0.2, 1], duration: 700, loop: true });

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2400);
    });
    if (cancelled) return;
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
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 700);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    app.ticker.remove(tick);
    [flash, bg, scanlines, warnText, frame, bossSprite, bossName, bossTitle].forEach((e) => e.destroy());
  };
}
