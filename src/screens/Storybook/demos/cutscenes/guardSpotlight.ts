import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { app } from '@/main';
import { ASSETS } from '@/assets';

export function guardSpotlight(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Full dark overlay — scene is barely lit
  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x030406);
  bg.alpha = 0;
  root.addChild(bg);

  // Faint grid lines — dirty sewer tiles
  const tiles = new Graphics();
  for (let x = 0; x < w; x += 18) {
    tiles
      .moveTo(x, 0)
      .lineTo(x, h)
      .stroke({ color: 0x0e1010, width: 1 });
  }
  for (let y = 0; y < h; y += 18) {
    tiles
      .moveTo(0, y)
      .lineTo(w, y)
      .stroke({ color: 0x0e1010, width: 1 });
  }
  tiles.alpha = 0;
  root.addChild(tiles);

  // Spotlight cone (Graphics polygon from a pivot point)
  const spotOrigin = { x: 0, y: h * 0.3 };
  const spotlight = new Graphics();
  root.addChild(spotlight);

  // The rat — hides behind a "pipe" block
  const pipeBlock = new Graphics();
  pipeBlock
    .roundRect(w * 0.65, h * 0.5, 28, 22, 3)
    .fill(0x3a3020)
    .stroke({ color: 0x1a1010, width: 1 });
  pipeBlock.alpha = 0;
  root.addChild(pipeBlock);

  const rat = new Sprite(Assets.get(ASSETS.prototype).textures['avatars_tile_1#0']);
  rat.anchor.set(0.5);
  rat.width = 28;
  rat.height = 28;
  rat.x = w * 0.72;
  rat.y = h * 0.58;
  rat.alpha = 0;
  rat.tint = 0x4a4038;
  root.addChild(rat);

  // Detected flash
  const detectedBg = new Graphics();
  detectedBg.rect(0, 0, w, h).fill(0xff1111);
  detectedBg.alpha = 0;
  root.addChild(detectedBg);

  const detectedText = new Text({
    text: '! DETECTED !',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 4, fill: 0xff2222, fontWeight: 'bold' },
  });
  detectedText.anchor.set(0.5);
  detectedText.x = w / 2;
  detectedText.y = h / 2 - 14;
  detectedText.alpha = 0;
  root.addChild(detectedText);

  const closeCallText = new Text({
    text: 'close call...',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x6a4a4a, letterSpacing: 2 },
  });
  closeCallText.anchor.set(0.5);
  closeCallText.x = w / 2;
  closeCallText.y = h / 2 + 10;
  closeCallText.alpha = 0;
  root.addChild(closeCallText);

  // Spotlight angle driven by ticker
  let spotAngle = -0.3;
  let spotSpeed = 0.008;
  let spotActive = false;
  let spotDetected = false;

  const RAT_X = w * 0.72;
  const RAT_Y = h * 0.58;
  const CONE_LEN = w * 1.2;
  const CONE_HALF = 0.22; // radians

  const drawSpotlight = (angle: number) => {
    const ox = spotOrigin.x;
    const oy = spotOrigin.y;
    const x1 = ox + Math.cos(angle - CONE_HALF) * CONE_LEN;
    const y1 = oy + Math.sin(angle - CONE_HALF) * CONE_LEN;
    const x2 = ox + Math.cos(angle + CONE_HALF) * CONE_LEN;
    const y2 = oy + Math.sin(angle + CONE_HALF) * CONE_LEN;

    spotlight
      .clear()
      .moveTo(ox, oy)
      .lineTo(x1, y1)
      .lineTo(x2, y2)
      .closePath()
      .fill({ color: 0xddcc88, alpha: 0.12 });

    // Beam center line (faint)
    spotlight
      .moveTo(ox, oy)
      .lineTo(ox + Math.cos(angle) * CONE_LEN * 0.6, oy + Math.sin(angle) * CONE_LEN * 0.6)
      .stroke({ color: 0xddcc88, width: 1, alpha: 0.06 });
  };

  const isRatInLight = (angle: number): boolean => {
    const dx = RAT_X - spotOrigin.x;
    const dy = RAT_Y - spotOrigin.y;
    const ratAngle = Math.atan2(dy, dx);
    const diff = Math.abs(((ratAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return diff < CONE_HALF;
  };

  const tick = () => {
    if (!spotActive || spotDetected) return;
    spotAngle += spotSpeed;
    if (spotAngle > 0.9 || spotAngle < -0.3) spotSpeed *= -1;
    drawSpotlight(spotAngle);
  };
  app.ticker.add(tick);

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    tiles.alpha = 0;
    spotlight.clear();
    pipeBlock.alpha = 0;
    rat.alpha = 0;
    rat.x = RAT_X;
    detectedBg.alpha = 0;
    detectedText.alpha = 0;
    closeCallText.alpha = 0;
    spotActive = false;
    spotDetected = false;
    spotAngle = -0.3;
    spotSpeed = 0.008;

    await animate(bg, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await animate(tiles, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await Promise.all([
      animate(pipeBlock, { alpha: 1, duration: 300 }),
      animate(rat, { alpha: 1, duration: 300 }),
    ]);
    if (cancelled) return;

    spotActive = true;

    // Spotlight sweeps — after 1.8s it approaches the rat
    await new Promise<void>((res) => {
      timer = setTimeout(res, 1800);
    });
    if (cancelled) return;

    // Speed up and sweep toward rat
    spotSpeed = 0.018;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (cancelled) return;

    // Rat ducks behind pipe
    await animate(rat, { x: RAT_X - 16, alpha: 0.1, duration: 200, ease: 'outQuad' });
    if (cancelled) return;

    // Light sweeps over rat position — DETECTED flash
    spotDetected = true;
    spotActive = false;
    spotlight.clear();

    await animate(detectedBg, { alpha: [0, 0.35, 0], duration: 300 });
    if (cancelled) return;

    await animate(detectedText, { alpha: 1, scaleX: [1.4, 1], scaleY: [1.4, 1], duration: 280, ease: 'outBack' });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (cancelled) return;

    // Rat survived — light moves on
    await animate(detectedText, { alpha: 0, duration: 300 });
    if (cancelled) return;

    await animate(closeCallText, { alpha: 1, duration: 400 });
    if (cancelled) return;

    // Rat peeks out slowly
    await animate(rat, { x: RAT_X, alpha: 0.5, duration: 500 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 1000);
    });
    if (cancelled) return;

    await Promise.all([
      animate(bg, { alpha: 0, duration: 500 }),
      animate(tiles, { alpha: 0, duration: 400 }),
      animate(pipeBlock, { alpha: 0, duration: 350 }),
      animate(rat, { alpha: 0, duration: 350 }),
      animate(closeCallText, { alpha: 0, duration: 350 }),
    ]);
    spotlight.clear();
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    app.ticker.remove(tick);
    [bg, tiles, spotlight, pipeBlock, rat, detectedBg, detectedText, closeCallText].forEach((e) => e.destroy());
  };
}
