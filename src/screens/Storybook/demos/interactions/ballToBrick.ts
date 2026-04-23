import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';
import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';

const BRICK_W = 40;
const BRICK_H = 18;
const BRICKS_N = 5;
const BRICK_GAP = 8;

export function ballToBrick(root: Container, w: number, h: number): () => void {
  const ctx = getGameContext();
  const brickTex = Assets.get('prototype').textures['bricks_tile_1#0'];
  const scrapTex = Assets.get('prototype').textures['scraps#0'];
  const ballTex = Assets.get('tiles').textures.ball;

  // Debris emitter
  const debris = new ParticleEmitter({
    texture: scrapTex,
    maxParticles: 100,
    emitting: false,
    lifespan: { min: 250, max: 600 },
    speed: { min: 40, max: 140 },
    angle: { min: -160, max: -20 },
    gravityY: 280,
    scale: { start: { min: 0.2, max: 0.5 }, end: 0 },
    rotate: { min: -300, max: 300 },
    tint: { start: 0xffcc88, end: 0x332211 },
  });
  root.addChild(debris.container);

  // Brick row
  const totalW = BRICKS_N * (BRICK_W + BRICK_GAP) - BRICK_GAP;
  const brickY = h / 2 - 60;
  const brickX0 = (w - totalW) / 2;

  interface BrickObj { sprite: Sprite; alive: boolean; x: number; y: number }
  const bricks: BrickObj[] = [];

  const spawnBricks = () => {
    bricks.forEach((b) => b.sprite.destroy());
    bricks.length = 0;

    for (let i = 0; i < BRICKS_N; i++) {
      const bx = brickX0 + i * (BRICK_W + BRICK_GAP);
      const sprite = new Sprite(brickTex);
      sprite.anchor.set(0, 0);
      sprite.width = BRICK_W;
      sprite.height = BRICK_H;
      sprite.x = bx;
      sprite.y = brickY;
      sprite.alpha = 0;
      root.addChild(sprite);
      animate(sprite, { alpha: 1, scaleY: [0, 1], duration: 250, delay: i * 60, ease: 'outBack' });
      bricks.push({ sprite, alive: true, x: bx, y: brickY });
    }
  };

  spawnBricks();

  // Paddle / launch origin visual
  const paddle = new Graphics();
  paddle.roundRect(0, 0, 60, 10, 5).fill(0x9944bb);
  paddle.x = w / 2 - 30;
  paddle.y = h - 60;
  root.addChild(paddle);

  // Ball sprite (starts at paddle, gets cloned per shot)
  let firing = false;

  const fire = async () => {
    if (firing) return;
    const nextBrick = bricks.find((b) => b.alive);
    if (!nextBrick) {
      spawnBricks();
      return;
    }
    firing = true;

    const ball = new Sprite(ballTex);
    ball.anchor.set(0.5);
    ball.scale.set(0.7);
    ball.tint = 0xddbbff;
    ball.x = w / 2;
    ball.y = paddle.y;
    root.addChild(ball);

    // Animate ball arc toward the brick's center
    const targetX = nextBrick.x + BRICK_W / 2;
    const targetY = nextBrick.y + BRICK_H / 2;

    // Ball spins while flying
    const spinAnim = animate(ball, { rotation: Math.PI * 4, duration: 400 });

    await animate(ball, {
      x: targetX,
      y: targetY,
      duration: 380,
      ease: 'inSine',
    });

    spinAnim.cancel();

    // Impact
    nextBrick.alive = false;

    debris.x = targetX;
    debris.y = targetY;
    debris.explode(20);

    shake(ctx.camera, { intensity: 5, duration: 250, frequency: 16 });

    // Break animation
    animate(nextBrick.sprite, {
      scaleX: [1, 1.3, 0],
      scaleY: [1, 0.7, 0],
      duration: 180,
      ease: 'inBack(2)',
    }).then(() => { nextBrick.sprite.visible = false; });

    // Score popup
    const popup = new Text({
      text: '+1 SCRAP',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: 0xffcc44 },
    });
    popup.anchor.set(0.5);
    popup.x = targetX;
    popup.y = targetY - 10;
    root.addChild(popup);
    animate(popup, { y: targetY - 40, alpha: 0, duration: 550, ease: 'outQuad' }).then(() => popup.destroy());

    // Ball shrinks and disappears on impact
    await animate(ball, { scaleX: 0, scaleY: 0, alpha: 0, duration: 150, ease: 'inSine' });
    ball.destroy();

    firing = false;

    // Auto-respawn if all bricks gone
    if (bricks.every((b) => !b.alive)) {
      setTimeout(spawnBricks, 700);
    }
  };

  // Fire button
  const btnBg = new LayoutContainer({
    layout: {
      width: 140, paddingTop: 10, paddingBottom: 10,
      backgroundColor: 0x110820,
      borderColor: 0x9944bb,
      borderWidth: 2,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  btnBg.addChild(
    new Text({ text: '● FIRE', style: { ...TEXT_STYLE_DEFAULT, fontSize: 12, fill: 0xddaaff }, layout: true })
  );
  const btn = new Button(btnBg);
  btn.view!.x = w / 2 - 70;
  btn.view!.y = h - 40;
  btn.onHover.connect(() => { btnBg.background.tint = 0xcc88ff; });
  btn.onOut.connect(() => { btnBg.background.tint = 0xffffff; });
  btn.onDown.connect(() => { btnBg.scale.set(0.95); });
  btn.onUp.connect(() => { btnBg.scale.set(1.0); });
  btn.onPress.connect(fire);
  root.addChild(btn.view!);

  const hint = new Text({
    text: 'each press fires at next brick →',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, fill: 0x443366 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h / 2 + 20;
  root.addChild(hint);

  return () => {
    debris.destroy();
    bricks.forEach((b) => b.sprite.destroy());
    paddle.destroy();
    btn.view?.destroy({ children: true });
    hint.destroy();
  };
}
