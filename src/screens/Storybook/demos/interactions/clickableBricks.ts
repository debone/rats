import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';
import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { ASSETS } from '@/assets';

const COLS = 5;
const ROWS = 3;
const BW = 44;
const BH = 20;
const GAP_X = 6;
const GAP_Y = 6;
const MAX_HP = 3;

interface BrickState {
  sprite: Sprite;
  hpBar: Graphics;
  flash: Graphics;
  hp: number;
  alive: boolean;
}

export function clickableBricks(root: Container, w: number, h: number): () => void {
  const ctx = getGameContext();
  const brickTex = Assets.get(ASSETS.prototype).textures['bricks_tile_1#0'];
  const scrapTex = Assets.get(ASSETS.prototype).textures['scraps#0'];

  const totalW = COLS * (BW + GAP_X) - GAP_X;
  const totalH = ROWS * (BH + GAP_Y) - GAP_Y;
  const originX = (w - totalW) / 2;
  const originY = (h - totalH) / 2 - 40;

  const debris = new ParticleEmitter({
    texture: scrapTex,
    maxParticles: 120,
    emitting: false,
    lifespan: { min: 200, max: 500 },
    speed: { min: 30, max: 120 },
    angle: { min: 0, max: 360 },
    gravityY: 300,
    scale: { start: { min: 0.2, max: 0.5 }, end: 0 },
    rotate: { min: -300, max: 300 },
    tint: { start: 0xffcc88, end: 0x332211 },
  });
  root.addChild(debris.container);

  const scoreText = new Text({
    text: 'CLICK A BRICK',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: 0x554477 },
  });
  scoreText.anchor.set(0.5);
  scoreText.x = w / 2;
  scoreText.y = h - 30;
  root.addChild(scoreText);

  let scraps = 0;
  let alive = 0;

  const bricks: BrickState[] = [];

  const spawnBrick = (col: number, row: number) => {
    const bx = originX + col * (BW + GAP_X);
    const by = originY + row * (BH + GAP_Y);

    const sprite = new Sprite(brickTex);
    sprite.anchor.set(0, 0);
    sprite.width = BW;
    sprite.height = BH;
    sprite.x = bx;
    sprite.y = by;
    sprite.interactive = true;
    sprite.cursor = 'pointer';
    root.addChild(sprite);

    const hpBar = new Graphics();
    hpBar.x = bx;
    hpBar.y = by + BH + 1;
    root.addChild(hpBar);

    const flash = new Graphics();
    flash.rect(bx, by, BW, BH).fill(0xffffff);
    flash.alpha = 0;
    root.addChild(flash);

    const state: BrickState = { sprite, hpBar, flash, hp: MAX_HP, alive: true };

    const drawHp = () => {
      hpBar.clear();
      const pct = state.hp / MAX_HP;
      hpBar.rect(0, 0, BW * pct, 2).fill(pct > 0.6 ? 0x44ff88 : pct > 0.3 ? 0xffcc44 : 0xff4444);
    };
    drawHp();

    const hit = async () => {
      if (!state.alive) return;
      state.hp -= 1;
      drawHp();

      // Flash white
      flash.alpha = 0.6;
      animate(flash, { alpha: 0, duration: 120 });

      // Squash
      animate(sprite, { scaleX: [0.95, 1.05, 1], scaleY: [1.08, 0.95, 1], duration: 180, ease: 'outSine' });

      if (state.hp <= 0) {
        state.alive = false;
        alive--;

        // Particles burst
        debris.x = bx + BW / 2;
        debris.y = by + BH / 2;
        debris.explode(18);

        // Camera micro-shake
        shake(ctx.camera, { intensity: 3, duration: 200, frequency: 14 });

        // Scrap popup
        const popup = new Text({
          text: '+1',
          style: { ...TEXT_STYLE_DEFAULT, fontSize: 11, fill: 0xffcc44 },
        });
        popup.anchor.set(0.5);
        popup.x = bx + BW / 2;
        popup.y = by;
        root.addChild(popup);
        animate(popup, { y: by - 28, alpha: 0, duration: 600, ease: 'outQuad' }).then(() => popup.destroy());

        // Break animation
        await animate(sprite, { scaleX: 0, scaleY: 0, duration: 120, ease: 'inBack(2)' });
        sprite.visible = false;
        hpBar.visible = false;
        flash.visible = false;

        scraps++;
        scoreText.text = `${scraps} scrap${scraps !== 1 ? 's' : ''} collected`;

        if (alive === 0) {
          const allDone = new Text({
            text: 'ALL CLEAR! Resetting...',
            style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: 0x9944bb },
          });
          allDone.anchor.set(0.5);
          allDone.x = w / 2;
          allDone.y = originY - 18;
          root.addChild(allDone);

          setTimeout(() => {
            allDone.destroy();
            bricks.forEach((b) => resetBrick(b));
          }, 1200);
        }
      }
    };

    sprite.on('pointertap', hit);
    bricks.push(state);
    alive++;
    return state;
  };

  const resetBrick = (b: BrickState) => {
    b.hp = MAX_HP;
    b.alive = true;
    b.sprite.visible = true;
    b.hpBar.visible = true;
    b.flash.visible = true;
    b.sprite.scale.set(1);
    const pct = 1;
    b.hpBar
      .clear()
      .rect(0, 0, BW * pct, 2)
      .fill(0x44ff88);
    animate(b.sprite, { scaleX: [0, 1], scaleY: [0, 1], duration: 250, ease: 'outBack(1.5)' });
    alive++;
  };

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      spawnBrick(col, row);
    }
  }

  return () => {
    debris.destroy();
    scoreText.destroy();
    bricks.forEach((b) => {
      b.sprite.destroy();
      b.hpBar.destroy();
      b.flash.destroy();
    });
  };
}
