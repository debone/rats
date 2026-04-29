import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { makeSplatTexture, makeSoftPuffTexture } from '../particleTextures';

export function sprayGraffiti(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cx = w / 2;
  const cy = h / 2;

  // Bake particle textures once — destroyed in cleanup
  const splatTex = makeSplatTexture();
  const puffTex = makeSoftPuffTexture();

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x080808);
  bg.alpha = 0;
  root.addChild(bg);

  // Brick wall texture
  const wall = new Graphics();
  const BRICK_H = 10;
  const BRICK_W = 22;
  for (let row = 0; row < Math.ceil(h / BRICK_H); row++) {
    const offsetX = row % 2 === 0 ? 0 : BRICK_W / 2;
    for (let col = -1; col < Math.ceil(w / BRICK_W) + 1; col++) {
      wall
        .rect(col * BRICK_W + offsetX, row * BRICK_H, BRICK_W - 1, BRICK_H - 1)
        .fill({ color: 0x1a1410, alpha: 0.8 })
        .stroke({ color: 0x0e0c0a, width: 0.5 });
    }
  }
  wall.alpha = 0;
  root.addChild(wall);

  const tagText = new Text({
    text: 'RATS RUN THIS',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 14, letterSpacing: 2, fill: 0xcc4422, fontWeight: 'bold' },
  });
  tagText.anchor.set(0.5);
  tagText.x = cx;
  tagText.y = cy;
  tagText.alpha = 0;
  root.addChild(tagText);

  const drips = new Graphics();
  root.addChild(drips);

  /**
   * Splat spray: each particle is a central blob with radial micro-drops,
   * so individual particles read as paint impacts on the wall rather than
   * round blobs of color.
   */
  const spray = new ParticleEmitter({
    texture: splatTex,
    maxParticles: 120,
    emitting: false,
    lifespan: { min: 80, max: 250 },
    speed: { min: 10, max: 50 },
    angle: { min: 200, max: 340 },
    scale: { start: { min: 0.25, max: 0.6 }, end: 0 },
    tint: { start: 0xdd4422, end: 0x881100 },
    alpha: { start: 0.9, end: 0 },
  });
  spray.y = cy;
  root.addChild(spray.container);

  /**
   * Soft-puff mist: the feathered gradient circles blend together into a
   * real aerosol cloud around the spray zone. Stack this behind splats for
   * the two-layer VFX composition effect.
   */
  const mist = new ParticleEmitter({
    texture: puffTex,
    maxParticles: 60,
    emitting: false,
    lifespan: { min: 300, max: 700 },
    speed: { min: 5, max: 22 },
    angle: { min: 180, max: 360 },
    scale: { start: { min: 0.15, max: 0.5 }, end: 1.0 },
    tint: { start: 0xcc3318, end: 0x440800 },
    alpha: { start: 0.22, end: 0 },
  });
  mist.y = cy;
  root.addChild(mist.container);

  const subText = new Text({
    text: 'sewer art  ·  block 7',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x6a3a2a, letterSpacing: 2 },
  });
  subText.anchor.set(0.5);
  subText.x = cx;
  subText.y = cy + 22;
  subText.alpha = 0;
  root.addChild(subText);

  const drawDrips = (tagAlpha: number) => {
    drips.clear();
    if (tagAlpha < 0.1) return;
    const DRIP_POSITIONS = [cx - 50, cx - 20, cx + 10, cx + 40];
    DRIP_POSITIONS.forEach((dx, i) => {
      const dripLen = (8 + i * 5) * tagAlpha;
      drips
        .moveTo(dx, cy + 8)
        .lineTo(dx, cy + 8 + dripLen)
        .stroke({ color: 0xcc4422, width: 2, alpha: tagAlpha * 0.7 });
      drips
        .circle(dx, cy + 8 + dripLen, 2)
        .fill({ color: 0xcc4422, alpha: tagAlpha * 0.5 });
    });
  };

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    wall.alpha = 0;
    tagText.alpha = 0;
    subText.alpha = 0;
    drips.clear();

    await animate(bg, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await animate(wall, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 300);
    });
    if (cancelled) return;

    const sp = { x: cx - 68, tagAlpha: 0 };
    spray.x = sp.x;
    mist.x = sp.x;

    await animate(sp, {
      x: cx + 68,
      tagAlpha: 1,
      duration: 1400,
      ease: 'linear',
      onUpdate: () => {
        spray.x = sp.x;
        mist.x = sp.x;
        spray.explode(4);
        mist.explode(2);
        tagText.alpha = sp.tagAlpha;
        drawDrips(sp.tagAlpha);
      },
    });
    if (cancelled) return;

    await animate(subText, { alpha: 1, duration: 500 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2000);
    });
    if (cancelled) return;

    await Promise.all([
      animate(bg, { alpha: 0, duration: 500 }),
      animate(wall, { alpha: 0, duration: 400 }),
      animate(tagText, { alpha: 0, duration: 400 }),
      animate(subText, { alpha: 0, duration: 350 }),
    ]);
    drips.clear();
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
    spray.destroy();
    mist.destroy();
    splatTex.destroy(true);
    puffTex.destroy(true);
    [bg, wall, tagText, subText, drips].forEach((e) => e.destroy());
  };
}
