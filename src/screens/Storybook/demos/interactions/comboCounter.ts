import { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { shake } from '@/core/camera/effects/shake';
import { getGameContext } from '@/data/game-context';
import { animate } from 'animejs';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

const BRICKS_PER_ROW = 6;
const BW = 38;
const BH = 16;
const GAP = 5;
const COMBO_DECAY_MS = 1800;

export function comboCounter(root: Container, w: number, h: number): () => void {
  const ctx = getGameContext();
  const brickTex = Assets.get('prototype').textures['bricks_tile_1#0'];
  const scrapTex = Assets.get('prototype').textures['scraps#0'];
  const ballTex = Assets.get('tiles').textures.ball;

  // Debris emitter
  const debris = new ParticleEmitter({
    texture: scrapTex,
    maxParticles: 80,
    emitting: false,
    lifespan: { min: 180, max: 400 },
    speed: { min: 30, max: 100 },
    angle: { min: 0, max: 360 },
    gravityY: 250,
    scale: { start: { min: 0.15, max: 0.4 }, end: 0 },
    rotate: { min: -200, max: 200 },
    tint: { start: 0xffcc88, end: 0x220000 },
  });
  root.addChild(debris.container);

  // Score particles
  const sparkle = new ParticleEmitter({
    texture: ballTex,
    maxParticles: 30,
    emitting: false,
    lifespan: { min: 250, max: 500 },
    speed: { min: 20, max: 80 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.2, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: 0xffee44,
  });
  root.addChild(sparkle.container);

  // Combo display (top center)
  const comboLabel = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 2, fill: 0x554477 },
  });
  comboLabel.anchor.set(0.5);
  comboLabel.x = w / 2;
  comboLabel.y = 12;
  root.addChild(comboLabel);

  const comboNum = new Text({
    text: '',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 40, fontWeight: 'bold', fill: 0xffcc44 },
  });
  comboNum.anchor.set(0.5);
  comboNum.x = w / 2;
  comboNum.y = 48;
  comboNum.alpha = 0;
  root.addChild(comboNum);

  const scoreLabel = new Text({
    text: 'SCORE: 0',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: 0x665588 },
  });
  scoreLabel.anchor.set(0.5);
  scoreLabel.x = w / 2;
  scoreLabel.y = 88;
  root.addChild(scoreLabel);

  // Combo decay bar
  const DECAY_BAR_W = 120;
  const decayBg = new Graphics();
  decayBg.roundRect(w / 2 - DECAY_BAR_W / 2, 100, DECAY_BAR_W, 4, 2).fill(0x111122);
  root.addChild(decayBg);

  const decayBar = new Graphics();
  root.addChild(decayBar);

  // Brick grid (3 rows)
  const ROWS = 3;
  const totalW = BRICKS_PER_ROW * (BW + GAP) - GAP;
  const brickX0 = (w - totalW) / 2;
  const brickY0 = h / 2 - 20;

  interface BrickObj { sprite: Sprite; x: number; y: number; alive: boolean }
  const bricks: BrickObj[] = [];

  const spawnBricks = () => {
    bricks.forEach((b) => b.sprite.destroy());
    bricks.length = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < BRICKS_PER_ROW; col++) {
        const bx = brickX0 + col * (BW + GAP);
        const by = brickY0 + row * (BH + GAP);
        const sprite = new Sprite(brickTex);
        sprite.anchor.set(0, 0);
        sprite.width = BW;
        sprite.height = BH;
        sprite.x = bx;
        sprite.y = by;
        sprite.interactive = true;
        sprite.cursor = 'pointer';
        sprite.alpha = 0;
        root.addChild(sprite);
        animate(sprite, { alpha: 1, scaleY: [0, 1], duration: 200, delay: (row * BRICKS_PER_ROW + col) * 30, ease: 'outBack' });
        const obj: BrickObj = { sprite, x: bx, y: by, alive: true };
        bricks.push(obj);
        sprite.on('pointertap', () => breakBrick(obj));
      }
    }
  };

  let combo = 0;
  let score = 0;
  let decayTimeout: ReturnType<typeof setTimeout> | undefined;
  let decayAnim: ReturnType<typeof animate> | undefined;
  const decayProxy = { progress: 1 };

  const resetCombo = () => {
    combo = 0;
    comboNum.alpha = 0;
    comboLabel.text = '';
    decayBar.clear();
  };

  const triggerDecay = () => {
    clearTimeout(decayTimeout);
    decayAnim?.cancel();
    decayProxy.progress = 1;

    decayAnim = animate(decayProxy, {
      progress: 0,
      duration: COMBO_DECAY_MS,
      ease: 'linear',
      onUpdate: () => {
        decayBar.clear().roundRect(
          w / 2 - DECAY_BAR_W / 2,
          100,
          DECAY_BAR_W * decayProxy.progress,
          4,
          2,
        ).fill(0x9944bb);
      },
    });

    decayTimeout = setTimeout(resetCombo, COMBO_DECAY_MS);
  };

  const breakBrick = async (obj: BrickObj) => {
    if (!obj.alive) return;
    obj.alive = false;
    obj.sprite.interactive = false;

    debris.x = obj.x + BW / 2;
    debris.y = obj.y + BH / 2;
    debris.explode(12);

    combo++;
    score += combo; // each hit in a combo is worth more
    scoreLabel.text = `SCORE: ${score}`;

    // Combo display
    comboNum.text = `×${combo}`;
    comboNum.alpha = 1;
    comboNum.scale.set(1.5);

    const comboColor = combo < 3 ? 0xffee44 : combo < 6 ? 0xff8844 : combo < 10 ? 0xff4488 : 0xcc44ff;
    comboNum.style.fill = comboColor;

    animate(comboNum, { scaleX: 1, scaleY: 1, duration: 200, ease: 'outBack(2)' });

    if (combo === 1) comboLabel.text = '';
    else if (combo < 3) comboLabel.text = 'NICE!';
    else if (combo < 6) comboLabel.text = 'GREAT!';
    else if (combo < 10) comboLabel.text = 'AMAZING!';
    else comboLabel.text = 'UNSTOPPABLE!';

    sparkle.x = obj.x + BW / 2;
    sparkle.y = obj.y + BH / 2;
    sparkle.explode(combo > 5 ? 12 : 5);

    if (combo > 3) shake(ctx.camera, { intensity: Math.min(combo, 10), duration: 200, frequency: 16 });

    // Score popup at brick
    const pts = new Text({
      text: `+${combo}`,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 10, fill: comboColor },
    });
    pts.anchor.set(0.5);
    pts.x = obj.x + BW / 2;
    pts.y = obj.y;
    root.addChild(pts);
    animate(pts, { y: obj.y - 24, alpha: 0, duration: 500, ease: 'outQuad' }).then(() => pts.destroy());

    await animate(obj.sprite, { scaleX: 0, scaleY: 0, duration: 140, ease: 'inBack(2)' });
    obj.sprite.visible = false;

    triggerDecay();

    if (bricks.every((b) => !b.alive)) {
      clearTimeout(decayTimeout);
      decayAnim?.cancel();
      decayBar.clear();
      comboNum.alpha = 0;
      comboLabel.text = '';
      combo = 0;
      setTimeout(spawnBricks, 600);
    }
  };

  const hint = new Text({
    text: 'click bricks fast for higher combo multiplier',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, fill: 0x332244 },
  });
  hint.anchor.set(0.5);
  hint.x = w / 2;
  hint.y = h - 14;
  root.addChild(hint);

  spawnBricks();

  return () => {
    clearTimeout(decayTimeout);
    decayAnim?.cancel();
    debris.destroy();
    sparkle.destroy();
    bricks.forEach((b) => b.sprite.destroy());
    [comboLabel, comboNum, scoreLabel, decayBg, decayBar, hint].forEach((e) => e.destroy());
  };
}
