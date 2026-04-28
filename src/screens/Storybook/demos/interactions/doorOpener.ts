import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';
import { ASSETS } from '@/assets';

const REQUIRED = 5;

export function doorOpener(root: Container, w: number, h: number): () => void {
  const ctx = getGameContext();
  const doorTex = Assets.get(ASSETS.prototype).textures['bricks_tile_2#0'];
  const cheeseTex = Assets.get(ASSETS.prototype).textures['cheese_tile_1#0'];
  const ballTex = Assets.get('tiles').textures.ball;

  // Door — 4 segments side by side, sliding outward when opened
  const DOOR_SEG_W = 30;
  const DOOR_H = 20;
  const DOOR_SEGS = 4;
  const doorCenterX = w / 2;
  const doorY = h / 2 - 20;

  const doorLeft: Sprite[] = [];
  const doorRight: Sprite[] = [];

  for (let i = 0; i < DOOR_SEGS / 2; i++) {
    const sL = new Sprite(doorTex);
    sL.anchor.set(0, 0);
    sL.width = DOOR_SEG_W;
    sL.height = DOOR_H;
    sL.x = doorCenterX - (i + 1) * DOOR_SEG_W;
    sL.y = doorY;
    root.addChild(sL);
    doorLeft.push(sL);

    const sR = new Sprite(doorTex);
    sR.anchor.set(0, 0);
    sR.width = DOOR_SEG_W;
    sR.height = DOOR_H;
    sR.x = doorCenterX + i * DOOR_SEG_W;
    sR.y = doorY;
    root.addChild(sR);
    doorRight.push(sR);
  }

  // Door label
  const doorLabel = new Text({
    text: 'DOOR',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 2, fill: 0x6644aa },
  });
  doorLabel.anchor.set(0.5);
  doorLabel.x = w / 2;
  doorLabel.y = doorY - 14;
  root.addChild(doorLabel);

  // Requirement bar
  const BAR_W = 120;
  const barX = w / 2 - BAR_W / 2;
  const barY = doorY + DOOR_H + 12;

  const barBg = new Graphics();
  barBg.roundRect(barX, barY, BAR_W, 8, 3).fill(0x0d0d1e).stroke({ color: 0x221133, width: 1 });
  root.addChild(barBg);

  const barFill = new Graphics();
  root.addChild(barFill);

  const drawBar = (filled: number) => {
    barFill
      .clear()
      .roundRect(barX, barY, BAR_W * (filled / REQUIRED), 8, 3)
      .fill(0x9944bb);
  };
  drawBar(0);

  const reqText = new Text({
    text: `0 / ${REQUIRED} cheese`,
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x664488 },
  });
  reqText.anchor.set(0.5);
  reqText.x = w / 2;
  reqText.y = barY + 16;
  root.addChild(reqText);

  // Collect particles
  const burst = new ParticleEmitter({
    texture: ballTex,
    maxParticles: 40,
    emitting: false,
    lifespan: { min: 300, max: 600 },
    speed: { min: 30, max: 100 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.2, end: 0 },
    tint: 0x9944bb,
    alpha: { start: 1, end: 0 },
  });
  root.addChild(burst.container);

  // Cheese bricks — 5 clickable bricks below bar
  const CBRICK_W = 36;
  const CBRICK_H = 36;
  const cbrickY = barY + 40;
  const cbrickTotalW = REQUIRED * (CBRICK_W + 6) - 6;
  const cbrickX0 = (w - cbrickTotalW) / 2;

  let collected = 0;
  let opened = false;

  interface CheeseBrick {
    sprite: Sprite;
    icon: Sprite;
    done: boolean;
  }
  const cbricks: CheeseBrick[] = [];

  const collectOne = async (cb: CheeseBrick, idx: number) => {
    if (cb.done || opened) return;
    cb.done = true;
    collected++;

    // Shrink brick
    animate(cb.sprite, { scaleX: 0, scaleY: 0, alpha: 0, duration: 200, ease: 'inBack(2)' });
    // Fly cheese icon to bar
    await animate(cb.icon, {
      x: w / 2,
      y: barY,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 350,
      ease: 'inBack(1.2)',
    });
    cb.icon.visible = false;

    drawBar(collected);
    reqText.text = `${collected} / ${REQUIRED} cheese`;

    burst.x = w / 2;
    burst.y = barY;
    burst.explode(6);

    if (collected >= REQUIRED && !opened) {
      opened = true;
      openDoor();
    }
  };

  for (let i = 0; i < REQUIRED; i++) {
    const bx = cbrickX0 + i * (CBRICK_W + 6);

    const sprite = new Sprite(Assets.get(ASSETS.prototype).textures['bricks_tile_1#0']);
    sprite.anchor.set(0, 0);
    sprite.width = CBRICK_W;
    sprite.height = CBRICK_H;
    sprite.x = bx;
    sprite.y = cbrickY;
    sprite.interactive = true;
    sprite.cursor = 'pointer';
    root.addChild(sprite);

    const icon = new Sprite(cheeseTex);
    icon.anchor.set(0.5);
    icon.scale.set(0.7);
    icon.x = bx + CBRICK_W / 2;
    icon.y = cbrickY + CBRICK_H / 2;
    root.addChild(icon);

    const cb: CheeseBrick = { sprite, icon, done: false };
    cbricks.push(cb);
    const capturedCb = cb;
    sprite.on('pointertap', () => collectOne(capturedCb, i));
  }

  const openDoor = async () => {
    doorLabel.text = 'OPEN!';
    doorLabel.style.fill = 0x44ff88;

    shake(ctx.camera, { intensity: 6, duration: 500, frequency: 14 });

    // Slide left halves left, right halves right
    const slideAmt = (DOOR_SEGS / 2) * DOOR_SEG_W + 20;
    doorLeft.forEach((s, i) => {
      animate(s, { x: s.x - slideAmt - i * 10, duration: 600, ease: 'outBack(1.2)', delay: i * 60 });
    });
    doorRight.forEach((s, i) => {
      animate(s, { x: s.x + slideAmt + i * 10, duration: 600, ease: 'outBack(1.2)', delay: i * 60 });
    });

    burst.x = w / 2;
    burst.y = doorY + DOOR_H / 2;
    burst.explode(30);

    await new Promise<void>((res) => setTimeout(res, 2200));

    // Reset after showing
    const reset = new Text({
      text: 'Resetting...',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0x554477 },
    });
    reset.anchor.set(0.5);
    reset.x = w / 2;
    reset.y = h - 14;
    root.addChild(reset);

    await new Promise<void>((res) => setTimeout(res, 800));
    reset.destroy();
    resetAll();
  };

  const resetAll = () => {
    collected = 0;
    opened = false;
    drawBar(0);
    reqText.text = `0 / ${REQUIRED} cheese`;
    doorLabel.text = 'DOOR';
    doorLabel.style.fill = 0x6644aa;

    // Restore door positions
    doorLeft.forEach((s, i) => {
      s.x = doorCenterX - (i + 1) * DOOR_SEG_W;
      animate(s, { x: doorCenterX - (i + 1) * DOOR_SEG_W, duration: 400, ease: 'outBack' });
    });
    doorRight.forEach((s, i) => {
      s.x = doorCenterX + i * DOOR_SEG_W;
      animate(s, { x: doorCenterX + i * DOOR_SEG_W, duration: 400, ease: 'outBack' });
    });

    cbricks.forEach((cb, i) => {
      cb.done = false;
      cb.sprite.visible = true;
      cb.icon.visible = true;
      cb.sprite.interactive = true;
      cb.sprite.scale.set(1);
      cb.sprite.alpha = 1;
      cb.icon.scale.set(0.7);
      cb.icon.x = cbrickX0 + i * (CBRICK_W + 6) + CBRICK_W / 2;
      cb.icon.y = cbrickY + CBRICK_H / 2;
      animate(cb.sprite, { scaleX: [0, 1], scaleY: [0, 1], duration: 250, ease: 'outBack', delay: i * 50 });
    });
  };

  const hint = new Text({
    text: 'click cheese bricks to fill the bar and open the door',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x332244 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 14;
  root.addChild(hint);

  return () => {
    burst.destroy();
    doorLeft.forEach((s) => s.destroy());
    doorRight.forEach((s) => s.destroy());
    doorLabel.destroy();
    barBg.destroy();
    barFill.destroy();
    reqText.destroy();
    cbricks.forEach((cb) => {
      cb.sprite.destroy();
      cb.icon.destroy();
    });
    hint.destroy();
  };
}
