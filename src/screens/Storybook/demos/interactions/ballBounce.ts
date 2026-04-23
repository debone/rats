/**
 * Mini playable breakout — simplified physics using animejs (no Box2D).
 * Ball bounces off walls, breaks bricks, collects cheese.
 * Paddle controlled by clicking left/right halves of preview.
 */
import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { app } from '@/main';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const PADDLE_W = 60;
const PADDLE_H = 8;
const BALL_R = 6;
const BRICK_W = 36;
const BRICK_H = 12;
const BRICK_COLS = 6;
const BRICK_ROWS = 3;
const SPEED = 220; // px/s

export function ballBounce(root: Container, w: number, h: number): () => void {
  const scrapTex = Assets.get('prototype').textures['scraps#0'];
  const ballTex = Assets.get('tiles').textures.ball;

  // Debris
  const debris = new ParticleEmitter({
    texture: scrapTex,
    maxParticles: 60,
    emitting: false,
    lifespan: { min: 180, max: 400 },
    speed: { min: 30, max: 90 },
    angle: { min: 0, max: 360 },
    gravityY: 250,
    scale: { start: { min: 0.15, max: 0.35 }, end: 0 },
    rotate: { min: -200, max: 200 },
    tint: { start: 0xffcc88, end: 0x441100 },
  });
  root.addChild(debris.container);

  // Paddle
  const paddle = new Graphics();
  const PADDLE_Y = h - 30;
  let paddleX = w / 2 - PADDLE_W / 2;

  const drawPaddle = () => {
    paddle.clear().roundRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H, 4).fill(0x9944bb);
  };
  drawPaddle();
  root.addChild(paddle);

  // Ball
  const ball = new Sprite(ballTex);
  ball.anchor.set(0.5);
  ball.scale.set(BALL_R / 8);
  ball.tint = 0xddbbff;
  let bx = w / 2;
  let by = PADDLE_Y - BALL_R - 2;
  let vx = SPEED * 0.6;
  let vy = -SPEED;
  let launched = false;
  ball.x = bx;
  ball.y = by;
  root.addChild(ball);

  // Bricks
  const brickGapX = 5;
  const brickGapY = 5;
  const totalBW = BRICK_COLS * (BRICK_W + brickGapX) - brickGapX;
  const brickX0 = (w - totalBW) / 2;
  const brickY0 = 40;

  interface Brick { gfx: Graphics; alive: boolean; bx: number; by: number; color: number }
  const bricks: Brick[] = [];

  const COLORS = [0xff4444, 0xff8800, 0xffee22, 0x44ff88, 0x4488ff, 0xcc44ff];

  const spawnBricks = () => {
    bricks.forEach((b) => b.gfx.destroy());
    bricks.length = 0;
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const bxPos = brickX0 + col * (BRICK_W + brickGapX);
        const byPos = brickY0 + row * (BRICK_H + brickGapY);
        const color = COLORS[row % COLORS.length];
        const gfx = new Graphics();
        gfx.roundRect(bxPos, byPos, BRICK_W, BRICK_H, 3).fill(color);
        root.addChild(gfx);
        bricks.push({ gfx, alive: true, bx: bxPos, by: byPos, color });
      }
    }
  };

  spawnBricks();

  // Score
  let score = 0;
  const scoreText = new Text({
    text: 'SCORE: 0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 9, fill: 0x664488 },
  });
  scoreText.x = 4;
  scoreText.y = 4;
  root.addChild(scoreText);

  // Click to move paddle / launch
  const overlay = new Graphics();
  overlay.rect(0, 0, w, h).fill({ color: 0, alpha: 0 });
  overlay.interactive = true;
  overlay.on('pointermove', (e) => {
    const local = root.toLocal(e.global);
    paddleX = Math.max(0, Math.min(w - PADDLE_W, local.x - PADDLE_W / 2));
    drawPaddle();
    if (!launched) {
      bx = paddleX + PADDLE_W / 2;
      ball.x = bx;
    }
  });
  overlay.on('pointertap', () => { launched = true; });
  root.addChild(overlay);

  const hint = new Text({
    text: 'move mouse → click to launch',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x332244 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 14;
  root.addChild(hint);

  let gameOver = false;

  const tick = (time: { deltaMS: number }) => {
    if (!launched || gameOver) return;

    const dt = time.deltaMS / 1000;
    bx += vx * dt;
    by += vy * dt;

    // Wall bounces
    if (bx - BALL_R < 0) { bx = BALL_R; vx = Math.abs(vx); }
    if (bx + BALL_R > w) { bx = w - BALL_R; vx = -Math.abs(vx); }
    if (by - BALL_R < 0) { by = BALL_R; vy = Math.abs(vy); }

    // Paddle bounce
    if (
      vy > 0 &&
      by + BALL_R >= PADDLE_Y &&
      by + BALL_R <= PADDLE_Y + PADDLE_H + 4 &&
      bx >= paddleX - 2 &&
      bx <= paddleX + PADDLE_W + 2
    ) {
      vy = -Math.abs(vy);
      by = PADDLE_Y - BALL_R;
      // Add angle based on hit position
      const hitPct = (bx - paddleX) / PADDLE_W; // 0..1
      vx = (hitPct - 0.5) * SPEED * 1.6;
      // Clamp speed
      const spd = Math.sqrt(vx * vx + vy * vy);
      vx = (vx / spd) * SPEED;
      vy = (vy / spd) * SPEED;
    }

    // Ball lost
    if (by > h + 20) {
      bx = paddleX + PADDLE_W / 2;
      by = PADDLE_Y - BALL_R - 2;
      launched = false;
    }

    // Brick collision
    for (const brick of bricks) {
      if (!brick.alive) continue;
      const { bx: rx, by: ry } = brick;
      if (bx + BALL_R > rx && bx - BALL_R < rx + BRICK_W &&
          by + BALL_R > ry && by - BALL_R < ry + BRICK_H) {
        brick.alive = false;
        brick.gfx.visible = false;

        debris.x = rx + BRICK_W / 2;
        debris.y = ry + BRICK_H / 2;
        debris.explode(8);

        score++;
        scoreText.text = `SCORE: ${score}`;

        // Bounce: determine which face was hit
        const overlapX = Math.min(bx + BALL_R - rx, rx + BRICK_W - bx + BALL_R);
        const overlapY = Math.min(by + BALL_R - ry, ry + BRICK_H - by + BALL_R);
        if (overlapX < overlapY) vx = -vx;
        else vy = -vy;

        break; // one brick per frame
      }
    }

    // All bricks cleared
    if (bricks.every((b) => !b.alive) && !gameOver) {
      launched = false;
      bx = w / 2;
      by = PADDLE_Y - BALL_R - 2;
      setTimeout(spawnBricks, 600);
    }

    ball.x = bx;
    ball.y = by;
  };

  app.ticker.add(tick);

  return () => {
    app.ticker.remove(tick);
    debris.destroy();
    bricks.forEach((b) => b.gfx.destroy());
    paddle.destroy();
    ball.destroy();
    scoreText.destroy();
    overlay.destroy();
    hint.destroy();
  };
}
