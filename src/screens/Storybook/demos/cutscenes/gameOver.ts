import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';

export function gameOver(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryPulse: ReturnType<typeof animate> | null = null;
  const ctx = getGameContext();

  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill(0x000000);
  overlay.alpha = 0;
  root.addChild(overlay);

  const flash = new Graphics();
  flash.rect(0, 0, w, h).fill(0xffffff);
  flash.alpha = 0;
  root.addChild(flash);

  // Red vignette corners
  const vig = new Graphics();
  vig.rect(0, 0, w, h).fill({ color: 0xff0000, alpha: 0 });
  root.addChild(vig);

  // "GAME" and "OVER" as separate blocks for scatter
  const gameText = new Text({
    text: 'GAME',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 28, fontWeight: 'bold', fill: 0xff2222, letterSpacing: 4 },
  });
  gameText.anchor.set(1, 0.5);
  gameText.x = w / 2 - 4;
  gameText.y = h / 2 - 8;
  gameText.alpha = 0;
  root.addChild(gameText);

  const overText = new Text({
    text: 'OVER',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 28, fontWeight: 'bold', fill: 0xff2222, letterSpacing: 4 },
  });
  overText.anchor.set(0, 0.5);
  overText.x = w / 2 + 4;
  overText.y = h / 2 - 8;
  overText.alpha = 0;
  root.addChild(overText);

  // Decorative crack lines radiating from center
  const cracks = new Graphics();
  root.addChild(cracks);

  const retryText = new Text({
    text: '— TRY AGAIN —',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, letterSpacing: 4, fill: 0x664466 },
  });
  retryText.anchor.set(0.5);
  retryText.x = w / 2;
  retryText.y = h / 2 + 22;
  retryText.alpha = 0;
  root.addChild(retryText);

  const drawCracks = (alpha: number) => {
    const cx = w / 2;
    const cy = h / 2 - 8;
    const angles = [22, 70, 130, 200, 250, 310];
    cracks.clear();
    angles.forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      const len = 20 + Math.random() * 10;
      cracks.moveTo(cx, cy)
        .lineTo(cx + Math.cos(rad) * len, cy + Math.sin(rad) * len)
        .stroke({ color: 0xff2222, width: 1, alpha });
    });
  };

  const play = async () => {
    if (cancelled) return;

    overlay.alpha = 0;
    flash.alpha = 0;
    vig.alpha = 0;
    gameText.alpha = 0;
    gameText.x = w / 2 - 4;
    gameText.y = h / 2 - 8;
    gameText.scale.set(1);
    gameText.rotation = 0;
    overText.alpha = 0;
    overText.x = w / 2 + 4;
    overText.y = h / 2 - 8;
    overText.scale.set(1);
    overText.rotation = 0;
    retryText.alpha = 0;
    cracks.clear();
    retryPulse?.cancel();

    // White flash
    await animate(flash, { alpha: [0, 0.95, 0], duration: 220, ease: 'outQuad' });
    if (cancelled) return;

    await animate(overlay, { alpha: 0.88, duration: 220 });
    if (cancelled) return;

    shake(ctx.camera, { intensity: 10, duration: 500, frequency: 16 });

    // Red vignette pulses in
    animate(vig, { alpha: [0, 0.18, 0], duration: 600 });

    // GAME OVER slams in — GAME from left, OVER from right
    await Promise.all([
      animate(gameText, {
        x: [w / 2 - 80, w / 2 - 4],
        alpha: 1,
        scaleX: [1.5, 1],
        scaleY: [1.5, 1],
        duration: 400,
        ease: 'outBack(1.5)',
      }),
      animate(overText, {
        x: [w / 2 + 80, w / 2 + 4],
        alpha: 1,
        scaleX: [1.5, 1],
        scaleY: [1.5, 1],
        duration: 400,
        ease: 'outBack(1.5)',
      }),
    ]);
    if (cancelled) return;

    // Cracks appear briefly
    drawCracks(0.6);
    await new Promise<void>((res) => { timer = setTimeout(res, 300); });
    if (cancelled) return;
    cracks.clear();

    // Letters scatter apart
    await Promise.all([
      animate(gameText, {
        x: -60,
        y: h / 2 - 40,
        rotation: -0.5,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 1.6,
        duration: 520,
        ease: 'outQuad',
      }),
      animate(overText, {
        x: w + 40,
        y: h / 2 + 30,
        rotation: 0.4,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 1.6,
        duration: 520,
        ease: 'outQuad',
        delay: 60,
      }),
    ]);
    if (cancelled) return;

    await animate(retryText, { alpha: 1, duration: 350 });
    if (cancelled) return;

    retryPulse = animate(retryText, { alpha: [1, 0.15, 1], duration: 900, loop: true });

    await new Promise<void>((res) => { timer = setTimeout(res, 2200); });
    if (cancelled) return;

    retryPulse.cancel();
    await Promise.all([
      animate(overlay, { alpha: 0, duration: 400 }),
      animate(retryText, { alpha: 0, duration: 300 }),
    ]);
    if (cancelled) return;

    await new Promise<void>((res) => { timer = setTimeout(res, 500); });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    retryPulse?.cancel();
    [overlay, flash, vig, gameText, overText, cracks, retryText].forEach((e) => e.destroy());
  };
}
