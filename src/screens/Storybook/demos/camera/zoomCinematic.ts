import { zoom } from '@/core/camera/effects/zoom';
import { fade } from '@/core/camera/effects/fade';
import { getGameContext } from '@/data/game-context';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { delay } from '@/core/game/Coroutine';

export function zoomCinematic(root: Container, w: number, h: number): () => void {
  const ctx = getGameContext();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x08080f);
  root.addChild(bg);

  const cross = new Graphics();
  cross.rect(w / 2 - 1, 0, 2, h).fill({ color: 0x440066, alpha: 0.4 });
  cross.rect(0, h / 2 - 1, w, 2).fill({ color: 0x440066, alpha: 0.4 });
  root.addChild(cross);

  const target = new Text({
    text: '✦',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 36, fill: 0xcc44ff },
  });
  target.anchor.set(0.5);
  target.x = w / 2;
  target.y = h / 2;
  root.addChild(target);

  const hint = new Text({
    text: 'zoom in → hold → zoom out → fade → repeat',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x554466 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 20;
  root.addChild(hint);

  let cancelled = false;

  const play = async () => {
    while (!cancelled) {
      // Zoom in
      await zoom(ctx.camera, { scale: 1.6, duration: 600, easing: 'inOutSine' });
      if (cancelled) break;

      await delay(800);
      if (cancelled) break;

      // Fade to black
      await fade(ctx.camera, { to: 0, duration: 400 });
      if (cancelled) break;

      await delay(200);
      if (cancelled) break;

      // Reset zoom while black
      await zoom(ctx.camera, { scale: 1, duration: 0 });

      // Fade back in
      await fade(ctx.camera, { to: 1, duration: 500 });
      if (cancelled) break;

      await delay(1000);
    }

    // Restore camera
    await zoom(ctx.camera, { scale: 1, duration: 300 });
    await fade(ctx.camera, { to: 1, duration: 200 });
  };

  play();

  return () => {
    cancelled = true;
    // Ensure camera is restored even if play is mid-animation
    zoom(ctx.camera, { scale: 1, duration: 0 });
    fade(ctx.camera, { to: 1, duration: 0 });
    bg.destroy();
    cross.destroy();
    target.destroy();
    hint.destroy();
  };
}
